#!/usr/bin/env node
/**
 * Deep-links the Meta App Dashboard's "Facebook Login for Business"
 * settings page and tries to add our OAuth callback URL to Valid
 * OAuth Redirect URIs. Meta's dashboard uses complex React inputs
 * that sometimes resist automation, so this script:
 *   1. Navigates to the exact settings page
 *   2. Scrolls to the redirect URI field
 *   3. Attempts to type the URL into the input + click "Save changes"
 *   4. If any selector fails, pauses so you can complete it manually
 *      in the already-open browser window (state is saved for reuse).
 */

import { chromium } from 'playwright';
import path from 'node:path';

const APP_ID = process.env.META_APP_ID || '1042181045651851';
const REDIRECT_URI = process.env.META_OAUTH_REDIRECT_URI
  || 'https://creatorhub-backend-rtbl.onrender.com/api/role-room/instagram/oauth/callback';
const STATE_PATH = path.resolve(
  process.cwd(),
  process.env.META_STATE_FILE || '.meta-playwright-state.json',
);

const SETTINGS_URL = `https://developers.facebook.com/apps/${APP_ID}/fb-login-business/settings/`;

function log(msg) {
  console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`);
}

async function loadStorage() {
  try {
    const fs = await import('node:fs/promises');
    await fs.access(STATE_PATH);
    return STATE_PATH;
  } catch { return undefined; }
}

async function waitForLogin(page, maxSeconds = 600) {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (url.includes('developers.facebook.com') && !url.includes('/login')) return true;
    await page.waitForTimeout(2000);
  }
  return false;
}

(async () => {
  log(`App ID: ${APP_ID}`);
  log(`Redirect URI to add: ${REDIRECT_URI}`);
  log(`Target settings page: ${SETTINGS_URL}`);

  const storageState = await loadStorage();
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    storageState,
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto(SETTINGS_URL, { waitUntil: 'domcontentloaded' });

    if (!storageState) {
      log('Logg inn med Facebook business-kontoen din (opp til 10 min).');
      const ok = await waitForLogin(page);
      if (!ok) throw new Error('Login timed out.');
      await context.storageState({ path: STATE_PATH });
      log('✓ Login saved. Re-navigerer til settings…');
      await page.goto(SETTINGS_URL, { waitUntil: 'domcontentloaded' });
    }

    log('Ser etter "Valid OAuth Redirect URIs"-feltet…');
    await page.waitForTimeout(3000);

    // Try a few selectors to find the redirect URI input.
    const candidates = [
      'input[aria-label="Valid OAuth Redirect URIs"]',
      'input[placeholder*="Redirect" i]',
      'input[placeholder*="http" i]',
      'div[role="combobox"] input',
      'textarea[aria-label*="Redirect" i]',
    ];
    let input = null;
    for (const selector of candidates) {
      const loc = page.locator(selector).first();
      if ((await loc.count()) > 0) {
        try {
          await loc.scrollIntoViewIfNeeded();
          await loc.waitFor({ state: 'visible', timeout: 5000 });
          input = loc;
          log(`✓ Fant felt via selector: ${selector}`);
          break;
        } catch { /* try next */ }
      }
    }

    if (input) {
      // Existing chips may already contain the URI — check before typing.
      const alreadyPresent = await page.locator(`text="${REDIRECT_URI}"`).count();
      if (alreadyPresent > 0) {
        log(`Redirect URI ser allerede ut til å stå i feltet. Save-status:`);
      } else {
        await input.click();
        await input.type(REDIRECT_URI, { delay: 30 });
        await page.keyboard.press('Enter');
        log('✓ Fylte inn URI og trykket Enter.');
        await page.waitForTimeout(1500);
      }

      // Try to click save
      const saveButton = page.getByRole('button', { name: /save changes|save/i }).first();
      if ((await saveButton.count()) > 0 && await saveButton.isVisible().catch(() => false)) {
        await saveButton.click().catch(() => {});
        log('✓ Klikket Save changes. Sjekk nettleseren for bekreftelse.');
      } else {
        log('⚠ Fant ingen Save-knapp automatisk — klikk den manuelt i browseren.');
      }
    } else {
      log('⚠ Kunne ikke lokalisere redirect-URI-feltet via automatisk selector.');
      log('   Scroll ned til "Valid OAuth Redirect URIs" i browseren og lim inn:');
      log(`     ${REDIRECT_URI}`);
      log('   Deretter klikk "Save Changes". Browseren holder seg åpen i 10 min.');
    }

    log('Lar nettleseren stå åpen i 10 min for manuell ferdigstilling + verifisering…');
    await page.waitForTimeout(600_000);
  } catch (err) {
    console.error('Script failed:', err?.message ?? err);
    await page.screenshot({ path: 'meta-settings-failure.png', fullPage: true }).catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }
})();
