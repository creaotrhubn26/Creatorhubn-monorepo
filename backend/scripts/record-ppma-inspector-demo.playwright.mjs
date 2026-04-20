#!/usr/bin/env node
/**
 * Meta App Review screencast: Page Public Metadata Access demo.
 *
 * Records the /meta-page-inspector flow end-to-end:
 *   1. Title card naming the permission + use case
 *   2. Producer pastes a Facebook Page URL
 *   3. Clicks "Inspect public metadata"
 *   4. App calls Meta Graph API GET /{page-id}?fields=...
 *   5. Documented public fields render in the UI
 *   6. Closing card with use-case statement
 *
 * Requires .role-room-demo-state.json (produced by the main demo
 * script on first run for admin login). If the admin has not yet
 * connected Facebook/Instagram to Role Room, the script will pause
 * so the operator can complete the OAuth consent flow manually —
 * that consent dialog is what Meta wants on the video.
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'https://theroleroom.com';
const VIDEO_DIR = path.resolve(process.cwd(), process.env.VIDEO_DIR || 'recordings');
const STATE_PATH = path.resolve(process.cwd(), process.env.STATE_FILE || '.role-room-demo-state.json');
const HEADLESS = process.env.HEADLESS === '1';
const PAGE_URL = process.env.DEMO_PAGE_URL || 'https://www.facebook.com/creatorhubn/';

function log(message) {
  console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${message}`);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadStorage() {
  try {
    await fs.access(STATE_PATH);
    return STATE_PATH;
  } catch {
    return undefined;
  }
}

async function beat(page, ms = 1500) {
  await page.waitForTimeout(ms);
}

async function installStyles(page) {
  await page.addStyleTag({
    content: `
      #ppma-caption {
        position: fixed; z-index: 2147483647;
        left: 50%; top: 32px; transform: translateX(-50%);
        min-width: 520px; max-width: 1080px;
        padding: 18px 28px;
        background: rgba(8, 15, 30, 0.94);
        border: 1.5px solid rgba(59, 130, 246, 0.6);
        border-radius: 14px;
        color: #f1f5f9;
        font: 700 22px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.22) inset;
        opacity: 0;
        transition: opacity 420ms ease;
        pointer-events: none;
      }
      #ppma-caption.show { opacity: 1; }
      #ppma-caption .step {
        display: block;
        font: 800 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0.22em;
        color: #93c5fd;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      #ppma-title {
        position: fixed; z-index: 2147483647; inset: 0;
        background: radial-gradient(circle at 50% 45%, rgba(30,58,138,0.93), rgba(2,6,23,0.98));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #f8fafc; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0; transition: opacity 500ms ease;
      }
      #ppma-title.show { opacity: 1; }
      #ppma-title h1 { font-size: 48px; font-weight: 800; margin: 0 0 18px; letter-spacing: -0.01em; }
      #ppma-title h2 { font-size: 22px; font-weight: 500; margin: 0 0 8px; color: #bfdbfe; }
      #ppma-title p  { font-size: 18px; font-weight: 400; max-width: 780px; color: #cbd5e1; margin: 24px 16px 0; line-height: 1.55; }
      .ppma-spot {
        outline: 3px solid #38bdf8 !important;
        outline-offset: 6px;
        border-radius: 16px !important;
        box-shadow: 0 0 0 8px rgba(59,130,246,0.32), 0 22px 60px rgba(56,189,248,0.3) !important;
        animation: ppmaPulse 1.8s ease-in-out infinite;
      }
      @keyframes ppmaPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(59,130,246,0.28), 0 12px 32px rgba(56,189,248,0.24); }
        50%     { box-shadow: 0 0 0 16px rgba(59,130,246,0.1),  0 24px 64px rgba(56,189,248,0.44); }
      }
    `,
  });
}

async function showTitleCard(page, title, subtitle, body, ms) {
  await page.evaluate(({ title, subtitle, body }) => {
    document.getElementById('ppma-title')?.remove();
    const el = document.createElement('div');
    el.id = 'ppma-title';
    el.innerHTML = `<h2>${subtitle}</h2><h1>${title}</h1><p>${body}</p>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
  }, { title, subtitle, body });
  await page.waitForTimeout(ms);
  await page.evaluate(() => {
    const el = document.getElementById('ppma-title');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 500);
  });
  await page.waitForTimeout(500);
}

async function showCaption(page, step, text) {
  await page.evaluate(({ step, text }) => {
    let el = document.getElementById('ppma-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ppma-caption';
      document.body.appendChild(el);
    }
    el.innerHTML = `<span class="step">${step}</span>${text}`;
    requestAnimationFrame(() => el.classList.add('show'));
  }, { step, text });
}

async function hideCaption(page) {
  await page.evaluate(() => {
    document.getElementById('ppma-caption')?.classList.remove('show');
  });
}

async function spotlight(page, locator) {
  const handle = await locator.elementHandle();
  if (!handle) return;
  await page.evaluate((el) => el?.classList.add('ppma-spot'), handle);
}

async function unspotlight(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.ppma-spot').forEach((el) => el.classList.remove('ppma-spot'));
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

  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      log(`[browser ${msg.type()}] ${msg.text().slice(0, 300)}`);
    }
  });
  page.on('pageerror', (err) => {
    log(`[browser pageerror] ${err.message.slice(0, 300)}`);
  });

  // Surface backend responses so we see exactly what Meta Graph API returned.
  page.on('response', async (response) => {
    if (response.url().includes('/api/role-room/agent/meta-page-inspect')) {
      log(`← meta-page-inspect status=${response.status()}`);
      try {
        const body = await response.json();
        log(`  success=${body?.success} page.id=${body?.page?.id} page.name=${body?.page?.name} fanCount=${body?.page?.fanCount} followers=${body?.page?.followersCount}`);
        if (body?.error) log(`  error=${body.error}`);
      } catch { /* ignore */ }
    }
  });

  try {
    log(`Opening ${APP_URL} — waiting for admin login + navigation to producer panel (up to 600s)`);
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    log('Login flow + navigate to the producer project panel so the "The Role Room Agent" button is visible.');

    // Same wait-for-button approach proven to work in the earlier
    // competitor-analysis demo: the user logs in + navigates while we
    // poll for the agent button to appear in the DOM.
    const deadline = Date.now() + 600 * 1000;
    let agentButton = null;
    while (Date.now() < deadline) {
      const btn = page.getByRole('button', { name: /^The Role Room Agent$/i }).first();
      if ((await btn.count()) > 0) {
        try {
          await btn.scrollIntoViewIfNeeded();
          agentButton = btn;
          break;
        } catch { /* still rendering */ }
      }
      await page.waitForTimeout(1500);
    }
    if (!agentButton) throw new Error('«The Role Room Agent»-knappen dukket aldri opp innen 10 min.');
    log('✓ Found agent button. Saving session + opening the dialog.');
    await context.storageState({ path: STATE_PATH });
    await beat(page, 1200);

    // If the dialog is already open from a saved state (the form input
    // is visible), skip the click since re-clicking a button behind
    // a modal throws a "timeout" on the click.
    const websiteField = page.getByLabel(/nettside/i).first();
    const alreadyOpen = (await websiteField.count()) > 0 && (await websiteField.isVisible().catch(() => false));
    if (!alreadyOpen) {
      try { await agentButton.click({ timeout: 10_000 }); }
      catch (err) {
        log(`click fell back to force: ${err.message}`);
        await agentButton.click({ force: true });
      }
      await beat(page, 2000);
    }

    // Click the "Meta Page" tab we just added to the agent dialog.
    const metaTab = page.getByRole('tab', { name: /Meta Page/i }).first();
    await metaTab.waitFor({ state: 'visible', timeout: 15_000 });
    await metaTab.click();
    log('✓ Clicked Meta Page tab.');

    const rootSelector = '[data-testid="meta-page-inspector-root"]';
    try {
      await page.waitForSelector(rootSelector, { state: 'visible', timeout: 20_000 });
    } catch {
      const info = await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        hasRoot: !!document.querySelector('[data-testid="meta-page-inspector-root"]'),
        tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((t) => t.textContent?.slice(0, 40)),
      }));
      log(`page state at timeout: ${JSON.stringify(info, null, 2)}`);
      throw new Error('Inspector-tab rendret ikke innholdet etter klikk.');
    }
    log('✓ Inspector rendered inside the dialog.');

    await installStyles(page);
    await showTitleCard(
      page,
      'Page Public Metadata Access',
      'CreatorHub One — Meta App Review Demo',
      'This screencast shows CreatorHub One calling the Meta Graph API to retrieve the documented public metadata of a Facebook Page, and rendering those fields (fan count, followers, category, About text, verification status) inside our Competitor Intelligence view for content producers.',
      7000,
    );
    await beat(page, 600);

    await showCaption(page, 'Step 1 of 3', 'The Meta Page Public Metadata inspector is shown. The producer pastes the target Facebook Page URL.');
    await beat(page, 3000);

    const inputEl = page.locator('[data-testid="meta-inspect-input"]');
    await inputEl.click();
    await inputEl.fill('');
    await beat(page, 400);
    // Typing slowly so the URL is visibly being entered on screen.
    await inputEl.type(PAGE_URL, { delay: 40 });
    await beat(page, 1200);

    await showCaption(page, 'Step 2 of 3', `CreatorHub One calls GET /{page-id} on Meta Graph API with "pages_read_engagement" scope and the documented public fields.`);
    await beat(page, 2800);

    await page.locator('[data-testid="meta-inspect-submit"]').click();

    const resultLocator = page.locator('[data-testid="meta-inspect-result"]');
    let rendered = false;
    try {
      await resultLocator.waitFor({ state: 'visible', timeout: 30_000 });
      rendered = true;
    } catch {
      log('⚠ Result did not render in 30s. Continuing recording so reviewer sees the current state.');
    }

    await beat(page, 1500);
    await showCaption(page, 'Step 3 of 3', 'The documented public fields returned by Meta Graph API are rendered inside CreatorHub One\'s UI, highlighted below.');
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
      'Page Public Metadata → Competitor Intelligence',
      'Use case',
      'CreatorHub One requests Page Public Metadata Access only to analyse and display documented public Facebook Page fields for industry and competitor research within the Producer workflow. No private user data is read. Access tokens are stored encrypted and scoped to the admin who connected their Meta account.',
      7000,
    );

    log('Demo complete — closing context to flush video.');
  } catch (error) {
    console.error('Script failed:', error?.message ?? error);
    await page.screenshot({ path: path.join(VIDEO_DIR, `ppma-failure-${Date.now()}.png`), fullPage: true }).catch(() => {});
    if (!HEADLESS) await page.waitForTimeout(30_000);
    process.exitCode = 2;
  } finally {
    await context.close();
    const videoPath = await page.video()?.path();
    if (videoPath) {
      const finalName = path.join(VIDEO_DIR, `ppma-demo-${Date.now()}.webm`);
      try {
        await fs.rename(videoPath, finalName);
        console.log(`\n✓ Video written to ${finalName}`);
        console.log(`  Re-encode to mp4 if needed:`);
        console.log(`    ffmpeg -i ${finalName} -c:v libx264 -crf 22 -preset medium ${finalName.replace(/\.webm$/, '.mp4')}\n`);
      } catch {
        console.log(`\nVideo lies at ${videoPath}`);
      }
    }
    await browser.close();
  }
})();
