#!/usr/bin/env node
/**
 * find-poweroffice-application-key.playwright.mjs
 *
 * Åpner PowerOffice Developer Portal i din EKTE Chrome-profil
 * (daniel@creatorhubn.com / Default-profil) så du er allerede innlogget
 * med eksisterende sesjoner, og leter etter APPLICATION_KEY på
 * Profile/Applications-siden.
 *
 * ⚠️  VIKTIG: Lukk Chrome helt (Cmd+Q) før du kjører — Chrome låser
 * profil-mappen, og samtidig bruk fra Playwright kan korrumpere profilen.
 *
 * Kjør:
 *   node backend/scripts/find-poweroffice-application-key.playwright.mjs
 *
 * Override profil:
 *   CHROME_PROFILE='Profile 1' node backend/scripts/find-poweroffice-application-key.playwright.mjs
 */

import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const PORTAL_URL = process.env.POWEROFFICE_PORTAL_URL || 'https://developer.poweroffice.net/';
const CHROME_USER_DATA_DIR = process.env.CHROME_USER_DATA_DIR
  || `${process.env.HOME}/Library/Application Support/Google/Chrome`;
const CHROME_PROFILE = process.env.CHROME_PROFILE || 'Default';
const SCREENSHOT_PATH = '/tmp/poweroffice-profile.png';

// 32-tegn hex matcher format på Application Key og Subscription Keys.
const HEX_KEY_RE = /\b[0-9a-f]{32}\b/gi;

function ensureChromeClosed() {
  try {
    const out = execSync('pgrep -x "Google Chrome" || true', { encoding: 'utf8' }).trim();
    if (out) {
      console.error('\n❌ Chrome kjører fortsatt (pid: ' + out.replace(/\s+/g, ', ') + ').');
      console.error('   Lukk Chrome helt med Cmd+Q (ikke bare lukk vinduet) og prøv igjen.');
      console.error('   Hvis du fortsetter med Chrome åpen, kan profilen korrumperes.\n');
      process.exit(1);
    }
  } catch {
    // pgrep ikke tilgjengelig — fortsett, men advar
    console.warn('⚠️  Kan ikke verifisere at Chrome er lukket. Lukk Chrome (Cmd+Q) først.');
  }
}

async function main() {
  if (!fs.existsSync(CHROME_USER_DATA_DIR)) {
    console.error('❌ Fant ikke Chrome user-data-dir:', CHROME_USER_DATA_DIR);
    process.exit(1);
  }
  const profileDir = path.join(CHROME_USER_DATA_DIR, CHROME_PROFILE);
  if (!fs.existsSync(profileDir)) {
    console.error('❌ Fant ikke profil-mappe:', profileDir);
    console.error('   Tilgjengelige profiler:');
    for (const p of fs.readdirSync(CHROME_USER_DATA_DIR)) {
      if (p === 'Default' || p.startsWith('Profile')) console.error('   ·', p);
    }
    process.exit(1);
  }

  ensureChromeClosed();

  console.log(`▶ Bruker Chrome-profil: ${CHROME_PROFILE} (${profileDir})`);

  const context = await chromium.launchPersistentContext(CHROME_USER_DATA_DIR, {
    headless: false,
    channel: 'chrome',
    args: [
      `--profile-directory=${CHROME_PROFILE}`,
      // Skjul "Chrome is being controlled by automated test software"-bar
      '--disable-blink-features=AutomationControlled',
    ],
    // Fjern --enable-automation slik at banneret ikke vises
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: null,
    slowMo: 50,
  });

  // Lukk eventuelle åpne tabs fra Chrome-startup (kan være privileged about:blank
  // som ikke lar oss navigere). Åpner en fersk tab vi kontrollerer.
  const existingPages = context.pages();
  const page = await context.newPage();
  for (const p of existingPages) {
    await p.close().catch(() => {});
  }

  // Prøv flere kjente PowerOffice-portal-URL-er — utvikleren har flere.
  const candidateEntryUrls = [
    PORTAL_URL,
    'https://goapi.poweroffice.net/',
    'https://api.poweroffice.com/Web/Developer/',
    'https://developer.poweroffice.net/signin',
  ];

  let landed = false;
  for (const entry of candidateEntryUrls) {
    try {
      console.log('▶ Prøver', entry);
      const resp = await page.goto(entry, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500);
      const title = await page.title().catch(() => '');
      const currentUrl = page.url();
      console.log(`  · status=${resp?.status() ?? '?'}  title="${title}"  url=${currentUrl}`);
      if (resp && resp.status() < 400 && !/about:blank/.test(currentUrl)) {
        landed = true;
        break;
      }
    } catch (err) {
      console.log(`  · feilet: ${err?.message?.slice(0, 100)}`);
    }
  }

  if (!landed) {
    console.log('\n⚠️  Ingen av URL-ene lastet et innhold. Naviger MANUELT til PowerOffice-portalen i nettleseren —');
    console.log('   scriptet venter 30 sek og prøver så å lese keys fra siden du står på.\n');
    await page.waitForTimeout(30000);
  }

  // Sjekk innlogget-status. Hvis ikke, vent på manuell login.
  const currentHref = page.url();
  if (/sign-?in|login|auth/i.test(currentHref)) {
    console.log('\n⏸  På login-side. Logg inn manuelt — scriptet venter (timeout 5 min)...\n');
    await page.waitForFunction(
      () => !/sign-?in|login|auth/i.test(window.location.href),
      { timeout: 5 * 60 * 1000 },
    ).catch(() => {
      console.log('⏰ Login-timeout — fortsetter likevel.');
    });
  } else {
    console.log(`✅ På ${page.url()}`);
  }

  // Prøv et utvalg sannsynlige stier hvor APPLICATION_KEY vises.
  const candidatePaths = [
    '/profile',
    '/applications',
    '/my-apps',
    '/myapps',
    '/account',
    '/developer/applications',
    '/products',
  ];

  const foundKeys = new Set();

  for (const p of candidatePaths) {
    try {
      const url = new URL(p, PORTAL_URL).toString();
      console.log(`▶ Prøver ${url}`);
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!resp || resp.status() >= 400) {
        console.log(`  · ${resp?.status() ?? 'ingen respons'} — hopper`);
        continue;
      }
      await page.waitForTimeout(1200);
      const body = await page.content();
      const matches = body.match(HEX_KEY_RE) || [];
      if (matches.length > 0) {
        console.log(`  ✓ fant ${matches.length} hex-kandidat(er):`);
        for (const m of matches) {
          foundKeys.add(m.toLowerCase());
          console.log(`    · ${m}`);
        }
      }
    } catch (err) {
      console.log(`  · feilet: ${err?.message?.slice(0, 100)}`);
    }
  }

  // Forsøk å zoome inn på keys ved å lese inputs/textareas eksplisitt
  console.log('\n▶ Leser input/textarea/code-felter for keys på siste side...');
  const inputValues = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('input, textarea, code, pre, span').forEach((el) => {
      const text = ('value' in el ? el.value : el.textContent) || '';
      if (/^[0-9a-f]{32}$/i.test(text.trim())) {
        const label = (el.closest('label')?.textContent
          || el.previousElementSibling?.textContent
          || el.parentElement?.firstElementChild?.textContent
          || '').trim().slice(0, 80);
        out.push({ key: text.trim(), label });
      }
    });
    return out;
  });

  for (const { key, label } of inputValues) {
    foundKeys.add(key.toLowerCase());
    console.log(`  · ${key}  ← ${label || '(ingen label)'}`);
  }

  // Screenshot for visuell verifisering
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true }).catch(() => {});
  console.log(`\n📸 Screenshot: ${SCREENSHOT_PATH}`);

  // Summary — sammenlign mot kjente subscription-keys (om angitt)
  const knownPrimary = (process.env.POWEROFFICE_SUBSCRIPTION_KEY || '').toLowerCase();
  const knownSecondary = (process.env.POWEROFFICE_SUBSCRIPTION_KEY_SECONDARY || '').toLowerCase();
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  KANDIDATER FOR APPLICATION_KEY');
  console.log('══════════════════════════════════════════════════════════');
  let candidateCount = 0;
  for (const k of foundKeys) {
    if (k === knownPrimary || k === knownSecondary) {
      console.log(`  ${k}  ← subscription-key (allerede kjent)`);
    } else {
      candidateCount++;
      console.log(`  ${k}  ← ❓ kan være APPLICATION_KEY`);
    }
  }
  if (candidateCount === 0) {
    console.log('  Ingen ukjente hex-strings funnet. Sjekk screenshotet og naviger');
    console.log('  manuelt i nettleseren (den er fortsatt åpen). Når du finner');
    console.log('  Application Key, kopier verdien direkte.');
  }
  console.log('══════════════════════════════════════════════════════════');
  console.log(`\nNettleseren forblir åpen — trykk Ctrl+C når du er ferdig.`);
  console.log('⚠️  HUSK å lukke nettleseren før du åpner Chrome igjen.\n');

  // Hold nettleseren åpen så brukeren kan navigere selv
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('Feil:', err);
  process.exit(1);
});
