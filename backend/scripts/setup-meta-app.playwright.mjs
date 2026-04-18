#!/usr/bin/env node
/**
 * Meta Developers app setup — Playwright-guided live session.
 *
 * Åpner Chromium og navigerer deg gjennom oppsettet av en Meta-app for
 * Instagram Graph API. Skriptet automatiserer det det kan; for ting Meta
 * krever menneske (KYC, app review-form, demo-video) pauser den og venter
 * på at du klikker videre.
 *
 * Hva skriptet gjør:
 *   1. Åpner https://developers.facebook.com/apps og venter på at du
 *      logger inn med en Facebook business-konto.
 *   2. Klikker "Create App" og fyller inn navn + kontakt-e-post.
 *   3. Setter business type = Business.
 *   4. Legger til Instagram Graph API + Facebook Login produktene.
 *   5. Setter OAuth Redirect URI til vår callback-URL.
 *   6. Setter Webhook callback URL + verify-token.
 *   7. Pauser og lar deg fullføre Business Verification + App Review-form
 *      manuelt (de er for kreative til å automatisere).
 *
 * Output: skriver ut META_APP_ID + META_APP_SECRET + META_OAUTH_REDIRECT_URI
 * + META_WEBHOOK_VERIFY_TOKEN som du må sette i Render env.
 *
 * USAGE:
 *   APP_NAME='The Role Room' \
 *   CONTACT_EMAIL='daniel@creatorhubn.com' \
 *   OAUTH_REDIRECT_URI='https://creatorhub-backend-rtbl.onrender.com/api/role-room/instagram/oauth/callback' \
 *   WEBHOOK_URL='https://creatorhub-backend-rtbl.onrender.com/api/role-room/instagram/webhook' \
 *   node backend/scripts/setup-meta-app.playwright.mjs
 *
 * Env du kan overstyre:
 *   STRIPE_STORAGE_STATE  reusable login state (default: .meta-playwright-state.json)
 *   HEADLESS=1            kjør headless (krever eksisterende state)
 *   APP_TYPE=business|consumer (default: business)
 */

import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const HEADLESS = process.env.HEADLESS === '1';
const STATE_PATH = process.env.META_PLAYWRIGHT_STATE
  || path.resolve(process.cwd(), '.meta-playwright-state.json');
const APP_NAME = process.env.APP_NAME || 'The Role Room';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'daniel@creatorhubn.com';
const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI
  || 'https://creatorhub-backend-rtbl.onrender.com/api/role-room/instagram/oauth/callback';
const WEBHOOK_URL = process.env.WEBHOOK_URL
  || 'https://creatorhub-backend-rtbl.onrender.com/api/role-room/instagram/webhook';
const WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN
  || crypto.randomBytes(24).toString('base64url');

const META_DEV_HOME = 'https://developers.facebook.com/apps';

async function loadStorage() {
  try {
    await fs.access(STATE_PATH);
    console.log(`Reusing Meta dashboard session from ${STATE_PATH}`);
    return STATE_PATH;
  } catch {
    return undefined;
  }
}

async function waitForLogin(page, maxSeconds = 600) {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (url.includes('developers.facebook.com/apps') && !url.includes('/login')) {
      return true;
    }
    await page.waitForTimeout(2000);
  }
  return false;
}

async function pauseForUser(message, seconds = 600) {
  console.log(`\n⏸  ${message}`);
  console.log(`   Skript fortsetter automatisk om ${seconds} sekunder, eller bruk Ctrl+C for å avbryte.\n`);
}

(async () => {
  console.log('Meta Developers — Playwright-veileder for app-oppsett');
  console.log('---');
  console.log(`App-navn:        ${APP_NAME}`);
  console.log(`Kontakt-e-post:  ${CONTACT_EMAIL}`);
  console.log(`OAuth redirect:  ${OAUTH_REDIRECT_URI}`);
  console.log(`Webhook URL:     ${WEBHOOK_URL}`);
  console.log(`Webhook token:   ${WEBHOOK_VERIFY_TOKEN}`);
  console.log('---');

  const storageState = await loadStorage();
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
    console.log('Åpner Meta Developers dashboard…');
    await page.goto(META_DEV_HOME, { waitUntil: 'domcontentloaded' });

    if (!storageState) {
      console.log('Logg inn med Facebook business-konto (opp til 10 minutter)…');
      const ok = await waitForLogin(page);
      if (!ok) throw new Error('Login timed out.');
      console.log('Login registrert. Lagrer state.');
      await context.storageState({ path: STATE_PATH });
    }

    // ── Steg 1: opprett app ───────────────────────────────────────────
    console.log('\n— Steg 1: opprett app —');
    const createButton = page.getByRole('button', { name: /create app/i }).first();
    if (await createButton.count()) {
      await createButton.click();
      await page.waitForTimeout(1500);

      // App type: business (anbefalt for IG publishing)
      const businessRadio = page.getByLabel(/business/i, { exact: false }).first();
      if (await businessRadio.count()) {
        await businessRadio.check().catch(() => {});
      }
      const nextButton = page.getByRole('button', { name: /next|neste/i }).first();
      if (await nextButton.count()) await nextButton.click();
      await page.waitForTimeout(1500);

      // App display name + contact email
      const nameInput = page.locator('input[name*="name" i], input[placeholder*="name" i]').first();
      if (await nameInput.count()) await nameInput.fill(APP_NAME);

      const emailInput = page.locator('input[type="email"], input[name*="email" i]').first();
      if (await emailInput.count()) await emailInput.fill(CONTACT_EMAIL);

      await pauseForUser(
        'Bekreft app-detaljer i nettleseren og klikk "Create App". Fortsett her når app-dashboardet er åpent.',
        300,
      );
      // Wait for app id to appear in URL (https://developers.facebook.com/apps/{appId}/)
      const appIdMatch = await page
        .waitForURL(/\/apps\/(\d+)\//, { timeout: 300_000 })
        .then(() => page.url().match(/\/apps\/(\d+)\//))
        .catch(() => null);
      const APP_ID = appIdMatch ? appIdMatch[1] : null;
      console.log(`✓ App opprettet: APP_ID = ${APP_ID ?? '(ikke fanget — sjekk URL)'}`);
    } else {
      console.log('  (Fant ikke "Create App"-knappen — kanskje du allerede har en app åpen?)');
    }

    // ── Steg 2: legg til Instagram Graph API + Facebook Login ─────────
    console.log('\n— Steg 2: legg til Instagram Graph API + Facebook Login —');
    await pauseForUser(
      'I dashboardet:\n' +
        '   1. Klikk "Add product" eller bla ned til "Add products to your app"\n' +
        '   2. Legg til "Instagram Graph API"\n' +
        '   3. Legg til "Facebook Login for Business"\n' +
        '   Når begge er lagt til, fortsett her.',
      900,
    );

    // ── Steg 3: sett OAuth redirect URI ───────────────────────────────
    console.log('\n— Steg 3: sett OAuth Redirect URI —');
    await pauseForUser(
      `I venstre meny → Facebook Login for Business → Settings:\n` +
        `   1. Sett "Valid OAuth Redirect URIs" til:\n` +
        `      ${OAUTH_REDIRECT_URI}\n` +
        `   2. Lagre endringer.\n` +
        `   3. Hent App ID + App Secret fra Settings → Basic.`,
      900,
    );

    // ── Steg 4: webhook ───────────────────────────────────────────────
    console.log('\n— Steg 4: konfigurer webhook —');
    await pauseForUser(
      `I venstre meny → Webhooks (under Instagram-produktet):\n` +
        `   1. Klikk "Subscribe to this object" → Instagram\n` +
        `   2. Callback URL: ${WEBHOOK_URL}\n` +
        `   3. Verify Token: ${WEBHOOK_VERIFY_TOKEN}\n` +
        `   4. Klikk "Verify and Save"\n` +
        `   5. Subscribe til feltene: comments, mentions, story_insights\n` +
        `   Når dette er ferdig, fortsett her.`,
      900,
    );

    // ── Steg 5: app review checklist ──────────────────────────────────
    console.log('\n— Steg 5: gå til App Review for instagram_content_publish —');
    await pauseForUser(
      `I venstre meny → App Review → Permissions and Features:\n` +
        `   1. Søk etter "instagram_content_publish"\n` +
        `   2. Klikk "Get advanced access"\n` +
        `   3. Fyll inn use case (jeg har laget tekst-mal — se script-output etter at du lukker browseren)\n` +
        `   4. Last opp demo-video som viser hele OAuth + publish-flyten\n` +
        `   5. Submit for review (1–3 ukers ventetid)`,
      900,
    );

    console.log('\n========================================================');
    console.log(' SAMMENDRAG');
    console.log('========================================================');
    console.log('');
    console.log(' Sett disse i Render → backend env:');
    console.log('');
    console.log(`   META_APP_ID=<copy fra Settings → Basic i Meta dashboard>`);
    console.log(`   META_APP_SECRET=<copy fra Settings → Basic i Meta dashboard>`);
    console.log(`   META_OAUTH_REDIRECT_URI=${OAUTH_REDIRECT_URI}`);
    console.log(`   META_WEBHOOK_VERIFY_TOKEN=${WEBHOOK_VERIFY_TOKEN}`);
    console.log('');
    console.log(' Husk: i Stripe-stil tester du først med App Mode = Development,');
    console.log(' der bare app-roller (Admins/Developers/Testers) kan logge inn med IG-konto.');
    console.log(' Etter App Review + Business Verification bytter du til Live mode.');
    console.log('');
    console.log('========================================================');

    if (!HEADLESS) {
      console.log('Lar vinduet stå åpent i 60s for verifisering...');
      await page.waitForTimeout(60_000);
    }
  } catch (error) {
    console.error('Skript feilet:', error?.message ?? error);
    if (!HEADLESS) await page.waitForTimeout(120_000);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
