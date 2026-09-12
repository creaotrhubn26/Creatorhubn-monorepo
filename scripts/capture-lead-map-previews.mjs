#!/usr/bin/env node
/**
 * scripts/capture-lead-map-previews.mjs
 *
 * Fanger ekte skjermbilder fra Lead Map-grensesnittet og lagrer dem som
 * /lead-map-preview-{1,2,3}.png i frontend/client/public/.
 *
 * Strategi: åpner Chromium headed på /marketing-cockpit?tab=lead-map.
 * Hvis du ikke er innlogget, vil Lead Map-panelet ikke rendres — så
 * scriptet poller på .leaflet-container inntil 15 min. Når kartet er der,
 * fanger det 3 screenshots og lukker.
 *
 * Bruk:
 *   BASE_URL=https://theroleroom.com node scripts/capture-lead-map-previews.mjs
 *
 * (Default BASE_URL = http://localhost:5001)
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5001';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../frontend/client/public');

const WAIT_FOR_MAP_MIN = parseFloat(process.env.WAIT_FOR_MAP_MIN ?? '15');

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2, // retina
  });
  const page = await ctx.newPage();

  try {
    // Lead Map er en seksjon INNE i Admin Room → Marketing Cockpit-tab.
    const targets = [
      `${BASE_URL}/admin-room?tab=marketing-cockpit`,
      `${BASE_URL}/admin?tab=marketing-cockpit`,
      `${BASE_URL}/marketing-cockpit`,
    ];

    console.log(`[1/5] Åpner Chromium på ${targets[0]}`);
    console.log('       (logg inn via Google hvis du blir bedt om det)');
    await page.goto(targets[0], { waitUntil: 'domcontentloaded' }).catch(() => {});

    // ── Poll inntil .leaflet-container er der (dvs. Lead Map er montert) ──
    console.log(`[2/5] Venter på at Lead Map rendres (timeout ${WAIT_FOR_MAP_MIN} min)…`);
    const deadline = Date.now() + WAIT_FOR_MAP_MIN * 60_000;
    let attempt = 0;
    let mapReady = false;
    while (Date.now() < deadline) {
      attempt += 1;
      // Scroll ned i Marketing Cockpit slik at Lead Map-seksjonen kommer i view
      // (kartet er nederst på siden og kan trigge mount via lazy loading).
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        .catch(() => {});
      try {
        const found = await page.waitForSelector('.leaflet-container', { timeout: 6_000 });
        if (found) { mapReady = true; break; }
      } catch { /* fortsatt ikke der */ }

      // Hvis vi er på Google-OAuth eller en login-side: bare vent.
      // Hvis vi er på app-domenet uten kart, prøv alternative URL-er hver 3. runde.
      const url = page.url();
      const isAppDomain = url.startsWith(new URL(BASE_URL).origin);
      const isGoogle = url.includes('accounts.google.com');
      if (attempt % 4 === 0) {
        console.log(`       [polling ${attempt}] url=${url.split('?')[0]}`);
      }
      // Hver 6. runde, hvis vi er på app-domenet uten å nå Lead Map: prøv neste alt-URL
      if (attempt % 6 === 0 && isAppDomain && !isGoogle) {
        const next = targets[(attempt / 6) % targets.length];
        console.log(`       prøver alternativ URL: ${next}`);
        await page.goto(next, { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
    }
    if (!mapReady) {
      throw new Error(`Lead Map ikke rendret innen ${WAIT_FOR_MAP_MIN} min — bekreft at du er innlogget som admin og at modulen er deployet.`);
    }
    console.log('       ✓ Kart rendret. Venter på pins…');
    await page.waitForTimeout(3_500);

    // ── Screenshot #1: Kart-vy ─────────────────────────────────────────
    console.log('[3/5] Fanger preview #1 (kart-vy)…');
    const mapEl = page.locator('.leaflet-container').first();
    await mapEl.screenshot({ path: join(OUT_DIR, 'lead-map-preview-1.png') });

    // ── Screenshot #2: Pin-popup ───────────────────────────────────────
    console.log('[4/5] Klikker pin og fanger popup-preview #2…');
    const pins = page.locator('.leaflet-marker-icon');
    const pinCount = await pins.count();
    if (pinCount > 0) {
      await pins.first().click({ force: true });
      try {
        await page.waitForSelector('.leaflet-popup', { timeout: 5_000 });
        await page.waitForTimeout(900);
        await mapEl.screenshot({ path: join(OUT_DIR, 'lead-map-preview-2.png') });
      } catch {
        console.warn('       ⚠ Popup rendret ikke — preview #2 droppet.');
      }
    } else {
      console.warn(`       ⚠ Ingen pins funnet (count=${pinCount}) — preview #2 droppet.`);
    }

    // ── Screenshot #3: Site Discovery-dialog ───────────────────────────
    console.log('[5/5] Åpner Site Discovery og fanger preview #3…');
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);

    const candidates = [
      /site discovery/i,
      /oppdag/i,
      /discover/i,
      /finn leads/i,
      /finn nye/i,
    ];
    let opened = false;
    for (const re of candidates) {
      const btn = page.getByRole('button', { name: re }).first();
      if ((await btn.count()) > 0) {
        await btn.click().catch(() => {});
        try {
          await page.waitForSelector('[role="dialog"]', { timeout: 4_000 });
          opened = true;
          break;
        } catch { /* prøv neste */ }
      }
    }
    if (opened) {
      await page.waitForTimeout(900);
      const dialog = page.locator('[role="dialog"]').first();
      await dialog.screenshot({ path: join(OUT_DIR, 'lead-map-preview-3.png') });
    } else {
      console.warn('       ⚠ Site Discovery-knapp ikke funnet — preview #3 droppet.');
    }

    console.log('\n✓ Ferdig. Sjekk frontend/client/public/:');
    console.log('  · lead-map-preview-1.png  (kart-vy)');
    console.log('  · lead-map-preview-2.png  (pin-popup)');
    console.log('  · lead-map-preview-3.png  (Site Discovery)');
  } catch (err) {
    console.error('\nFEIL:', err.message ?? err);
    try {
      await page.screenshot({
        path: join(OUT_DIR, '_capture-debug.png'),
        fullPage: true,
      });
      console.error('Debug-screenshot lagret til frontend/client/public/_capture-debug.png');
    } catch { /* ignorer */ }
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
