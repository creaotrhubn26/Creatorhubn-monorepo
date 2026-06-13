#!/usr/bin/env node
/**
 * scripts/capture-lead-map-previews.mjs
 *
 * Fanger ekte skjermbilder fra Lead Map-grensesnittet og lagrer dem som
 * /lead-map-preview-{1,2,3}.png i frontend/client/public/.
 *
 * Bruk:
 *   # mot lokal dev (http://localhost:5001)
 *   BASE_URL=http://localhost:5001 \
 *   ADMIN_EMAIL=daniel@creatorhubn.com \
 *   ADMIN_PASSWORD=•••• \
 *   node scripts/capture-lead-map-previews.mjs
 *
 *   # mot prod
 *   BASE_URL=https://theroleroom.com \
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… \
 *   node scripts/capture-lead-map-previews.mjs
 *
 * Kjør først `pnpm dev` eller deploy. Skriptet logger inn som admin, navigerer
 * til Marketing Cockpit → Lead Map, og fanger 3 views: kart, pin-popup,
 * Site Discovery-dialog.
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('FEIL: Sett ADMIN_EMAIL og ADMIN_PASSWORD i env.');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../frontend/client/public');

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2, // retina-PNG
  });
  const page = await ctx.newPage();

  try {
    // 1. Login
    console.log(`[1/5] Logger inn som ${ADMIN_EMAIL} på ${BASE_URL}…`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // 2. Naviger til Marketing Cockpit → Lead Map
    console.log('[2/5] Navigerer til Lead Map…');
    await page.goto(`${BASE_URL}/marketing-cockpit?tab=lead-map`, { waitUntil: 'networkidle' });
    // Vent til kartet er rendret
    await page.waitForSelector('.leaflet-container', { timeout: 15_000 });
    await page.waitForTimeout(2_500); // la pins + tiles tegne seg

    // 3. Screenshot #1: Kart-vy
    console.log('[3/5] Fanger preview #1 (kart-vy)…');
    const mapEl = await page.locator('.leaflet-container').first();
    await mapEl.screenshot({
      path: join(OUT_DIR, 'lead-map-preview-1.png'),
    });

    // 4. Screenshot #2: Klikk på en pin og fang popup
    console.log('[4/5] Klikker pin og fanger popup-preview #2…');
    const firstPin = page.locator('.leaflet-marker-icon').first();
    if ((await firstPin.count()) > 0) {
      await firstPin.click();
      await page.waitForSelector('.leaflet-popup', { timeout: 5_000 });
      await page.waitForTimeout(800);
      await mapEl.screenshot({
        path: join(OUT_DIR, 'lead-map-preview-2.png'),
      });
    } else {
      console.warn('  ⚠ Ingen pins funnet — preview #2 droppet (legg inn testdata).');
    }

    // 5. Screenshot #3: Site Discovery-dialog
    console.log('[5/5] Åpner Site Discovery og fanger preview #3…');
    // Lukk popup først hvis den er åpen
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Finn "Site Discovery" / "Oppdag"-knapp i Lead Map-toolbar
    const discoveryBtn = page.getByRole('button', { name: /site discovery|oppdag|discover/i }).first();
    if ((await discoveryBtn.count()) > 0) {
      await discoveryBtn.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
      await page.waitForTimeout(800);
      // Fang hele dialog-området
      const dialog = page.locator('[role="dialog"]').first();
      await dialog.screenshot({
        path: join(OUT_DIR, 'lead-map-preview-3.png'),
      });
    } else {
      console.warn('  ⚠ Site Discovery-knapp ikke funnet — preview #3 droppet.');
    }

    console.log('\n✓ Ferdig. Bildene ligger i frontend/client/public/');
    console.log('  · lead-map-preview-1.png  (kart-vy)');
    console.log('  · lead-map-preview-2.png  (pin-popup)');
    console.log('  · lead-map-preview-3.png  (Site Discovery)');
  } catch (err) {
    console.error('FEIL:', err);
    // Lagre debug-screenshot
    await page.screenshot({ path: join(OUT_DIR, '_capture-debug.png'), fullPage: true })
      .catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
