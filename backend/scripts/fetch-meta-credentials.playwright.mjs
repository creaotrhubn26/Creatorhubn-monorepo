#!/usr/bin/env node
/**
 * Fetch META_APP_ID + META_APP_SECRET from an existing Meta Developers
 * app via Playwright. Reuses saved browser state, then scrapes Settings
 * → Basic by scanning every <input> on the page for the hex value
 * Meta reveals when you click "Show" next to App Secret. The broad
 * approach is deliberate — Meta renames DOM attributes more often
 * than they rotate app secrets, so hunting for name="app_secret" is
 * fragile. A 32-char-hex pattern is the stable fingerprint.
 */

import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const STATE_PATH = process.env.META_PLAYWRIGHT_STATE
  || path.resolve(process.cwd(), '.meta-playwright-state.json');
const OAUTH_REDIRECT_URI = process.env.META_OAUTH_REDIRECT_URI
  || 'https://creatorhub-backend-rtbl.onrender.com/api/role-room/instagram/oauth/callback';
const WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN
  || crypto.randomBytes(32).toString('hex');
const KNOWN_APP_ID = process.env.META_APP_ID || null;

const PICK_TIMEOUT_MS = 10 * 60 * 1000;
const REVEAL_TIMEOUT_MS = 10 * 60 * 1000;

async function loadStorage() {
  try {
    await fs.access(STATE_PATH);
    return STATE_PATH;
  } catch {
    return undefined;
  }
}

function log(message) {
  console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${message}`);
}

/**
 * Walk every <input> on the page and return the first value that
 * matches the Meta app-secret pattern (32 lowercase hex chars).
 * Meta's current dashboard renders the input inside a shadow-ish
 * wrapper with obfuscated class names, but getAttribute('value') or
 * .value both surface the revealed string once "Show" + password
 * have gone through.
 */
async function scrapeSecret(page) {
  return page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    for (const input of inputs) {
      const candidates = [input.value, input.getAttribute('value'), input.defaultValue];
      for (const candidate of candidates) {
        if (typeof candidate !== 'string') continue;
        const match = candidate.trim().match(/^[0-9a-f]{32}$/i);
        if (match) return match[0];
      }
    }
    // Fallback: sometimes Meta renders the secret as plain text in a
    // span once revealed, not as an input value. Scan the full
    // rendered DOM text for the same pattern.
    const bodyText = document.body?.innerText ?? '';
    const textMatch = bodyText.match(/\b[0-9a-f]{32}\b/i);
    return textMatch ? textMatch[0] : null;
  });
}

(async () => {
  const storageState = await loadStorage();

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    storageState,
    locale: 'nb-NO',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    log('Åpner Meta Developers dashboard…');
    if (KNOWN_APP_ID) {
      await page.goto(`https://developers.facebook.com/apps/${KNOWN_APP_ID}/settings/basic/`, {
        waitUntil: 'domcontentloaded',
      });
    } else {
      await page.goto('https://developers.facebook.com/apps/', { waitUntil: 'domcontentloaded' });
    }

    let appId = KNOWN_APP_ID;
    if (!appId) {
      log('Velg din app i listen — skriptet venter…');
      const deadline = Date.now() + PICK_TIMEOUT_MS;
      while (Date.now() < deadline && !appId) {
        const m = page.url().match(/\/apps\/(\d+)\//);
        if (m) {
          appId = m[1];
          log(`✓ Oppdaget APP_ID = ${appId}`);
          break;
        }
        await page.waitForTimeout(1500);
      }
      if (!appId) {
        throw new Error('Fant ingen app-id i URL — timed out.');
      }
    }

    log('Går til Settings → Basic…');
    await page.goto(`https://developers.facebook.com/apps/${appId}/settings/basic/`, {
      waitUntil: 'domcontentloaded',
    });

    log('');
    log('⏸  I nettleseren:');
    log('   1. Finn raden "App Secret"');
    log('   2. Klikk "Show"');
    log('   3. Skriv inn Facebook-passordet ditt på nytt');
    log('   4. Skriptet sniffer DOM-en hvert 1,5 sek — leser secreten så fort den er synlig.');
    log('');

    const deadline = Date.now() + REVEAL_TIMEOUT_MS;
    let appSecret = null;
    while (Date.now() < deadline) {
      try {
        const candidate = await scrapeSecret(page);
        if (candidate) {
          appSecret = candidate;
          break;
        }
      } catch {
        // keep polling
      }
      await page.waitForTimeout(1500);
    }
    if (!appSecret) {
      throw new Error('Klarte ikke å lese App Secret — klikket du "Show"?');
    }
    log(`✓ APP_SECRET = ${appSecret.slice(0, 6)}…${appSecret.slice(-4)} (lengde ${appSecret.length})`);

    await context.storageState({ path: STATE_PATH });

    console.log('\n========================================================');
    console.log(' RENDER ENV — lim disse inn på creatorhub-backend');
    console.log('========================================================');
    console.log(`META_APP_ID=${appId}`);
    console.log(`META_APP_SECRET=${appSecret}`);
    console.log(`META_OAUTH_REDIRECT_URI=${OAUTH_REDIRECT_URI}`);
    console.log(`META_WEBHOOK_VERIFY_TOKEN=${WEBHOOK_VERIFY_TOKEN}`);
    console.log('');
    console.log(' (META_LOGIN_CONFIG_ID kun hvis du bruker FB Login for Business');
    console.log('  med lagret konfigurasjon — ellers la den stå uten verdi.)');
    console.log('========================================================\n');
  } catch (error) {
    console.error('Skript feilet:', error?.message ?? error);
    console.error('Lar vinduet stå åpent i 2 minutter for debug.');
    await page.waitForTimeout(120_000);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
