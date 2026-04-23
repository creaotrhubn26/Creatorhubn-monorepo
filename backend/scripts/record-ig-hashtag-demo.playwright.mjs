#!/usr/bin/env node
/**
 * Meta App Review screencast: instagram_public_content_access demo.
 *
 * Captures the IG Hashtags tab flow end-to-end:
 *   1. Title card naming the feature + use case
 *   2. Producer opens the IG Hashtags tab in the Role Room Agent
 *   3. Typeahead: types a hashtag, debounced call to
 *      /ig_hashtag_search + /top_media, 3x3 grid of top posts renders
 *   4. AI-suggested hashtags: producer pastes a content context,
 *      clicks "Foreslå hashtags (AI + Meta)". Backend runs Claude +
 *      validates via Meta Hashtag Search, chip row populates.
 *   5. Producer clicks a ✓-validated suggestion — inspector swaps
 *      to that tag and shows its top_media.
 *   6. Closing card with use-case statement.
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'https://theroleroom.com';
const VIDEO_DIR = path.resolve(process.cwd(), process.env.VIDEO_DIR || 'recordings');
const STATE_PATH = path.resolve(process.cwd(), process.env.STATE_FILE || '.role-room-demo-state.json');
const HEADLESS = process.env.HEADLESS === '1';
const DEMO_HASHTAG = process.env.DEMO_HASHTAG || 'oslo';
const DEMO_CONTEXT = process.env.DEMO_CONTEXT
  || 'Stemningsfull morgen-reel fra ny pizzarestaurant i Oslo sentrum. Håndlaget surdeig, lokale råvarer, fokus på håndverk + atmosfære. Målgruppe: matelskere og Oslo-folk som går på Instagram Reels etter inspirasjon.';

function log(m) { console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${m}`); }
async function ensureDir(d) { await fs.mkdir(d, { recursive: true }); }
async function loadStorage() {
  try { await fs.access(STATE_PATH); return STATE_PATH; } catch { return undefined; }
}
async function beat(page, ms = 1500) { await page.waitForTimeout(ms); }

async function installStyles(page) {
  await page.addStyleTag({
    content: `
      #hashtag-caption {
        position: fixed; z-index: 2147483647;
        left: 50%; top: 32px; transform: translateX(-50%);
        min-width: 520px; max-width: 1080px;
        padding: 18px 28px;
        background: rgba(88, 12, 70, 0.94);
        border: 1.5px solid rgba(221, 42, 123, 0.6);
        border-radius: 14px;
        color: #fbcfe8;
        font: 700 22px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(221,42,123,0.22) inset;
        opacity: 0; transition: opacity 420ms ease; pointer-events: none;
      }
      #hashtag-caption.show { opacity: 1; }
      #hashtag-caption .step {
        display: block;
        font: 800 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0.22em; color: #f9a8d4; text-transform: uppercase; margin-bottom: 8px;
      }
      #hashtag-title {
        position: fixed; z-index: 2147483647; inset: 0;
        background: radial-gradient(circle at 50% 45%, rgba(131,24,67,0.93), rgba(2,6,23,0.98));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #f8fafc; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0; transition: opacity 500ms ease;
      }
      #hashtag-title.show { opacity: 1; }
      #hashtag-title h1 { font-size: 46px; font-weight: 800; margin: 0 0 18px; letter-spacing: -0.01em; }
      #hashtag-title h2 { font-size: 22px; font-weight: 500; margin: 0 0 8px; color: #f9a8d4; }
      #hashtag-title p  { font-size: 18px; font-weight: 400; max-width: 780px; color: #cbd5e1; margin: 24px 16px 0; line-height: 1.55; }
      .hashtag-spot {
        outline: 3px solid #db2777 !important;
        outline-offset: 6px;
        border-radius: 16px !important;
        box-shadow: 0 0 0 8px rgba(221,42,123,0.32), 0 22px 60px rgba(221,42,123,0.3) !important;
        animation: hashtagPulse 1.8s ease-in-out infinite;
      }
      @keyframes hashtagPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(221,42,123,0.28), 0 12px 32px rgba(221,42,123,0.24); }
        50%     { box-shadow: 0 0 0 16px rgba(221,42,123,0.1),  0 24px 64px rgba(221,42,123,0.44); }
      }
    `,
  });
}

async function showTitleCard(page, title, subtitle, body, ms) {
  await page.evaluate(({ title, subtitle, body }) => {
    document.getElementById('hashtag-title')?.remove();
    const el = document.createElement('div');
    el.id = 'hashtag-title';
    el.innerHTML = `<h2>${subtitle}</h2><h1>${title}</h1><p>${body}</p>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
  }, { title, subtitle, body });
  await page.waitForTimeout(ms);
  await page.evaluate(() => {
    const el = document.getElementById('hashtag-title');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 500);
  });
  await page.waitForTimeout(500);
}

async function showCaption(page, step, text) {
  await page.evaluate(({ step, text }) => {
    let el = document.getElementById('hashtag-caption');
    if (!el) { el = document.createElement('div'); el.id = 'hashtag-caption'; document.body.appendChild(el); }
    el.innerHTML = `<span class="step">${step}</span>${text}`;
    requestAnimationFrame(() => el.classList.add('show'));
  }, { step, text });
}

async function hideCaption(page) {
  await page.evaluate(() => { document.getElementById('hashtag-caption')?.classList.remove('show'); });
}

async function spotlight(page, locator) {
  const handle = await locator.elementHandle();
  if (!handle) return;
  await page.evaluate((el) => el?.classList.add('hashtag-spot'), handle);
}

async function unspotlight(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.hashtag-spot').forEach((el) => el.classList.remove('hashtag-spot'));
  });
}

(async () => {
  await ensureDir(VIDEO_DIR);
  log(`Recording to ${VIDEO_DIR}`);
  log(`Demo hashtag: ${DEMO_HASHTAG}`);

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
    if (response.url().includes('/ig-hashtag-inspect')) {
      log(`← ig-hashtag-inspect status=${response.status()}`);
      try {
        const body = await response.json();
        log(`  hashtag.id=${body?.hashtag?.id} posts=${body?.posts?.length}`);
      } catch { /* ignore */ }
    }
    if (response.url().includes('/hashtag-suggest')) {
      log(`← hashtag-suggest status=${response.status()}`);
      try {
        const body = await response.json();
        log(`  candidates=${body?.candidates?.length} validated=${body?.meta?.validated}`);
      } catch { /* ignore */ }
    }
  });

  try {
    log(`Opening ${APP_URL} — navigate to producer panel (up to 10 min)`);
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    const deadline = Date.now() + 600 * 1000;
    let agentButton = null;
    while (Date.now() < deadline) {
      const btn = page.getByRole('button', { name: /^The Role Room Agent$/i }).first();
      if ((await btn.count()) > 0) {
        try { await btn.scrollIntoViewIfNeeded(); agentButton = btn; break; }
        catch { /* retry */ }
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

    const igTab = page.getByRole('tab', { name: /IG Hashtags/i }).first();
    await igTab.waitFor({ state: 'visible', timeout: 15_000 });
    await igTab.click();
    log('✓ Clicked IG Hashtags tab.');

    const root = '[data-testid="ig-hashtag-inspector-root"]';
    await page.waitForSelector(root, { state: 'visible', timeout: 20_000 });
    log('✓ Inspector rendered.');

    await installStyles(page);
    await showTitleCard(
      page,
      'Instagram Public Content Access',
      'CreatorHub One — Meta App Review Demo',
      'This screencast shows CreatorHub One using the Instagram Public Content Access feature to search hashtags and surface top_media for producers. Two flows are demonstrated: live typeahead hashtag search, and AI-recommended hashtags based on the producer\'s content brief with Meta Graph validation.',
      7000,
    );
    await beat(page, 500);

    // --- Flow 1: typeahead hashtag search ---
    await showCaption(page, 'Step 1 of 3', 'Producer types a hashtag. Typeahead debounce (600ms) fires /ig_hashtag_search then /top_media. No click required.');
    await beat(page, 2500);

    const input = page.locator('[data-testid="ig-hashtag-input"]');
    await input.click();
    await input.type(DEMO_HASHTAG, { delay: 120 });
    // wait for typeahead + top_media render
    const resultLocator = page.locator('[data-testid="ig-hashtag-result"]');
    let rendered = false;
    try {
      await resultLocator.waitFor({ state: 'visible', timeout: 30_000 });
      rendered = true;
    } catch {
      log('⚠ typeahead result did not render in 30s.');
    }
    await beat(page, 1500);
    if (rendered) {
      await resultLocator.scrollIntoViewIfNeeded();
      await spotlight(page, resultLocator);
      await beat(page, 6000);
      await unspotlight(page);
    }

    // --- Flow 2: AI-suggested hashtags ---
    await showCaption(page, 'Step 2 of 3', 'Producer pastes content brief. Claude drafts hashtag candidates; each is validated in parallel against Meta /ig_hashtag_search.');
    await beat(page, 2800);

    const ctx = page.locator('[data-testid="ig-hashtag-context"]');
    await ctx.scrollIntoViewIfNeeded();
    await ctx.click();
    await ctx.fill(DEMO_CONTEXT);
    await beat(page, 1200);

    await page.locator('[data-testid="ig-hashtag-suggest"]').click();
    log('✓ Clicked Suggest. Waiting for Claude + Meta validation…');

    const suggestionsLocator = page.locator('[data-testid="ig-hashtag-suggestions"]');
    let suggested = false;
    try {
      await suggestionsLocator.waitFor({ state: 'visible', timeout: 60_000 });
      suggested = true;
    } catch {
      log('⚠ AI suggestions did not render in 60s.');
    }
    await beat(page, 1500);
    if (suggested) {
      await suggestionsLocator.scrollIntoViewIfNeeded();
      await spotlight(page, suggestionsLocator);
      await beat(page, 7000);
      await unspotlight(page);
    }

    // --- Flow 3: click an AI chip to see top_media ---
    if (suggested) {
      await showCaption(page, 'Step 3 of 3', 'Producer clicks a ✓-validated suggestion — inspector swaps to that tag and renders its top_media grid.');
      await beat(page, 2200);
      const firstValidatedChip = page.locator('[data-testid="ig-hashtag-suggestions"] .MuiChip-filled').first();
      if ((await firstValidatedChip.count()) > 0) {
        await firstValidatedChip.scrollIntoViewIfNeeded();
        await firstValidatedChip.click();
        log('✓ Clicked validated suggestion chip.');
        await beat(page, 3500);
        await resultLocator.scrollIntoViewIfNeeded();
        await spotlight(page, resultLocator);
        await beat(page, 6000);
        await unspotlight(page);
      }
    }

    await hideCaption(page);
    await beat(page, 500);
    await showTitleCard(
      page,
      'Campaign intel + hashtag discovery',
      'Use case',
      'CreatorHub One requests Instagram Public Content Access to discover content associated with client campaign hashtags, gauge public sentiment around their brand, and identify high-engagement creative references. The AI-assisted layer grounds Claude\'s suggestions in Meta-validated hashtag IDs so producers never paste dead or low-volume tags into a client\'s campaign. No private user data is accessed.',
      7000,
    );

    log('Demo complete — closing context to flush video.');
  } catch (error) {
    console.error('Script failed:', error?.message ?? error);
    await page.screenshot({ path: path.join(VIDEO_DIR, `ig-hashtag-failure-${Date.now()}.png`), fullPage: true }).catch(() => {});
    if (!HEADLESS) await page.waitForTimeout(30_000);
    process.exitCode = 2;
  } finally {
    await context.close();
    const videoPath = await page.video()?.path();
    if (videoPath) {
      const finalName = path.join(VIDEO_DIR, `ig-hashtag-demo-${Date.now()}.webm`);
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
