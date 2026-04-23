#!/usr/bin/env node
/**
 * Meta App Review screencast: attribution_read + ads_read demo.
 *
 * Records the Ads Attribution tab flow end-to-end:
 *   1. Title card naming the permissions + use case
 *   2. Producer pastes an Ad Account ID
 *   3. Clicks "Fetch attribution insights"
 *   4. App calls Meta Graph /act_{id}/insights with documented fields
 *      + [7d_click, 1d_view] attribution windows
 *   5. Impressions / clicks / spend / CPC / CPM / CTR / reach / frequency
 *      render in the 8-cell metric grid
 *   6. Closing card with use-case statement
 *
 * Requires .role-room-demo-state.json + an active Meta connection
 * with attribution_read + ads_read scopes granted.
 *
 * Pass DEMO_AD_ACCOUNT_ID for the ad account the demo should query.
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'https://theroleroom.com';
const VIDEO_DIR = path.resolve(process.cwd(), process.env.VIDEO_DIR || 'recordings');
const STATE_PATH = path.resolve(process.cwd(), process.env.STATE_FILE || '.role-room-demo-state.json');
const HEADLESS = process.env.HEADLESS === '1';
const AD_ACCOUNT_ID = process.env.DEMO_AD_ACCOUNT_ID || 'act_1234567890';

function log(message) {
  console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${message}`);
}

async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }
async function loadStorage() {
  try { await fs.access(STATE_PATH); return STATE_PATH; }
  catch { return undefined; }
}
async function beat(page, ms = 1500) { await page.waitForTimeout(ms); }

async function installStyles(page) {
  await page.addStyleTag({
    content: `
      #ads-caption {
        position: fixed; z-index: 2147483647;
        left: 50%; top: 32px; transform: translateX(-50%);
        min-width: 520px; max-width: 1080px;
        padding: 18px 28px;
        background: rgba(6,60,40,0.94);
        border: 1.5px solid rgba(16,185,129,0.6);
        border-radius: 14px;
        color: #ecfdf5;
        font: 700 22px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.22) inset;
        opacity: 0; transition: opacity 420ms ease; pointer-events: none;
      }
      #ads-caption.show { opacity: 1; }
      #ads-caption .step {
        display: block;
        font: 800 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0.22em; color: #6ee7b7; text-transform: uppercase; margin-bottom: 8px;
      }
      #ads-title {
        position: fixed; z-index: 2147483647; inset: 0;
        background: radial-gradient(circle at 50% 45%, rgba(6,78,59,0.93), rgba(2,6,23,0.98));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #f8fafc; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0; transition: opacity 500ms ease;
      }
      #ads-title.show { opacity: 1; }
      #ads-title h1 { font-size: 48px; font-weight: 800; margin: 0 0 18px; letter-spacing: -0.01em; }
      #ads-title h2 { font-size: 22px; font-weight: 500; margin: 0 0 8px; color: #a7f3d0; }
      #ads-title p  { font-size: 18px; font-weight: 400; max-width: 780px; color: #cbd5e1; margin: 24px 16px 0; line-height: 1.55; }
      .ads-spot {
        outline: 3px solid #10b981 !important;
        outline-offset: 6px;
        border-radius: 16px !important;
        box-shadow: 0 0 0 8px rgba(16,185,129,0.32), 0 22px 60px rgba(16,185,129,0.3) !important;
        animation: adsPulse 1.8s ease-in-out infinite;
      }
      @keyframes adsPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(16,185,129,0.28), 0 12px 32px rgba(16,185,129,0.24); }
        50%     { box-shadow: 0 0 0 16px rgba(16,185,129,0.1), 0 24px 64px rgba(16,185,129,0.44); }
      }
    `,
  });
}

async function showTitleCard(page, title, subtitle, body, ms) {
  await page.evaluate(({ title, subtitle, body }) => {
    document.getElementById('ads-title')?.remove();
    const el = document.createElement('div');
    el.id = 'ads-title';
    el.innerHTML = `<h2>${subtitle}</h2><h1>${title}</h1><p>${body}</p>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
  }, { title, subtitle, body });
  await page.waitForTimeout(ms);
  await page.evaluate(() => {
    const el = document.getElementById('ads-title');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 500);
  });
  await page.waitForTimeout(500);
}

async function showCaption(page, step, text) {
  await page.evaluate(({ step, text }) => {
    let el = document.getElementById('ads-caption');
    if (!el) { el = document.createElement('div'); el.id = 'ads-caption'; document.body.appendChild(el); }
    el.innerHTML = `<span class="step">${step}</span>${text}`;
    requestAnimationFrame(() => el.classList.add('show'));
  }, { step, text });
}

async function hideCaption(page) {
  await page.evaluate(() => { document.getElementById('ads-caption')?.classList.remove('show'); });
}

async function spotlight(page, locator) {
  const handle = await locator.elementHandle();
  if (!handle) return;
  await page.evaluate((el) => el?.classList.add('ads-spot'), handle);
}

async function unspotlight(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.ads-spot').forEach((el) => el.classList.remove('ads-spot'));
  });
}

(async () => {
  await ensureDir(VIDEO_DIR);
  log(`Recording to ${VIDEO_DIR}`);

  const storageState = await loadStorage();
  const browser = await chromium.launch({ headless: HEADLESS, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    storageState,
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  page.on('response', async (response) => {
    if (response.url().includes('/api/role-room/agent/ads-attribution-inspect')) {
      log(`← ads-attribution-inspect status=${response.status()}`);
      try {
        const body = await response.json();
        log(`  success=${body?.success} insights=${body?.insights ? 'present' : 'null'}`);
        if (body?.error) log(`  error=${body.error}`);
      } catch { /* ignore */ }
    }
  });

  try {
    log(`Opening ${APP_URL} — navigate to producer panel so agent button shows (up to 10 min)`);
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    const deadline = Date.now() + 600 * 1000;
    let agentButton = null;
    while (Date.now() < deadline) {
      const btn = page.getByRole('button', { name: /^The Role Room Agent$/i }).first();
      if ((await btn.count()) > 0) {
        try {
          await btn.scrollIntoViewIfNeeded();
          agentButton = btn;
          break;
        } catch { /* retry */ }
      }
      await page.waitForTimeout(1500);
    }
    if (!agentButton) throw new Error('Agent button never appeared within 10 min.');
    log('✓ Found agent button.');
    await context.storageState({ path: STATE_PATH });
    await beat(page, 1200);

    const websiteField = page.getByLabel(/nettside/i).first();
    const alreadyOpen = (await websiteField.count()) > 0 && (await websiteField.isVisible().catch(() => false));
    if (!alreadyOpen) {
      try { await agentButton.click({ timeout: 10_000 }); }
      catch { await agentButton.click({ force: true }); }
      await beat(page, 2000);
    }

    const adsTab = page.getByRole('tab', { name: /Ads Attribution/i }).first();
    await adsTab.waitFor({ state: 'visible', timeout: 15_000 });
    await adsTab.click();
    log('✓ Clicked Ads Attribution tab.');

    const rootSelector = '[data-testid="ads-attribution-inspector-root"]';
    await page.waitForSelector(rootSelector, { state: 'visible', timeout: 20_000 });
    log('✓ Inspector rendered.');

    await installStyles(page);
    await showTitleCard(
      page,
      'attribution_read + ads_read',
      'CreatorHub One — Meta App Review Demo',
      'This screencast shows CreatorHub One calling Meta Graph Ads Insights API with the documented last-7-days preset and [7d_click, 1d_view] attribution windows, and rendering the impressions, clicks, spend, CPC, CPM, CTR, reach and frequency metrics inside the Ads Attribution panel so producers can benchmark paid campaign performance for their client.',
      7000,
    );
    await beat(page, 600);

    await showCaption(page, 'Step 1 of 3', 'The producer opens the Ads Attribution panel and pastes the client\'s Ad Account ID.');
    await beat(page, 3000);

    const input = page.locator('[data-testid="ads-inspect-input"]');
    await input.click();
    await input.fill('');
    await beat(page, 400);
    await input.type(AD_ACCOUNT_ID, { delay: 40 });
    await beat(page, 1200);

    await showCaption(page, 'Step 2 of 3', `CreatorHub One calls GET /act_{id}/insights on Meta Graph API with documented fields and attribution_read + ads_read scopes.`);
    await beat(page, 2800);

    await page.locator('[data-testid="ads-inspect-submit"]').click();

    const resultLocator = page.locator('[data-testid="ads-inspect-result"]');
    let rendered = false;
    try {
      await resultLocator.waitFor({ state: 'visible', timeout: 30_000 });
      rendered = true;
    } catch {
      log('⚠ Result did not render in 30s. Continuing recording anyway.');
    }

    await beat(page, 1500);
    await showCaption(page, 'Step 3 of 3', 'Impressions, clicks, spend, CPC, CPM, CTR, reach and frequency — as returned by Meta Graph Ads Insights — rendered in the UI.');
    await beat(page, 1800);

    if (rendered) {
      await resultLocator.scrollIntoViewIfNeeded();
      await spotlight(page, resultLocator);
      await beat(page, 9000);
      await unspotlight(page);
      await beat(page, 1000);
    } else {
      await beat(page, 4000);
    }

    await hideCaption(page);
    await beat(page, 500);
    await showTitleCard(
      page,
      'Ads Attribution → Campaign Intelligence',
      'Use case',
      'CreatorHub One requests attribution_read + ads_read only to retrieve and display documented Meta Ads Insights fields — impressions, clicks, spend, CPC, CPM, CTR, reach, frequency and action-level attribution — for ad accounts the signed-in admin has a role on. No private user data is read. Access tokens are stored encrypted (AES-256, AUTH_SECRET-derived key) and scoped per-admin to the user who connected the Meta integration.',
      7000,
    );

    log('Demo complete — closing context to flush video.');
  } catch (error) {
    console.error('Script failed:', error?.message ?? error);
    await page.screenshot({ path: path.join(VIDEO_DIR, `ads-failure-${Date.now()}.png`), fullPage: true }).catch(() => {});
    if (!HEADLESS) await page.waitForTimeout(30_000);
    process.exitCode = 2;
  } finally {
    await context.close();
    const videoPath = await page.video()?.path();
    if (videoPath) {
      const finalName = path.join(VIDEO_DIR, `ads-attribution-demo-${Date.now()}.webm`);
      try {
        await fs.rename(videoPath, finalName);
        console.log(`\n✓ Video written to ${finalName}`);
        console.log(`  Re-encode to mp4:`);
        console.log(`    ffmpeg -i ${finalName} -c:v libx264 -crf 22 -preset medium ${finalName.replace(/\.webm$/, '.mp4')}\n`);
      } catch {
        console.log(`\nVideo lies at ${videoPath}`);
      }
    }
    await browser.close();
  }
})();
