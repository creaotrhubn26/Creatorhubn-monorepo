#!/usr/bin/env node
/**
 * Meta App Review screencast: Page Public Content Access demo.
 *
 * Records the Page Content inspector flow end-to-end:
 *   1. Title card naming the permission + use case
 *   2. Producer pastes a Facebook Page URL
 *   3. Clicks "Fetch recent posts + videos"
 *   4. App calls Meta Graph API GET /{page-id}/posts + /{page-id}/videos
 *   5. Recent posts + videos render as scannable lists
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
      #ppca-caption {
        position: fixed; z-index: 2147483647;
        left: 50%; top: 32px; transform: translateX(-50%);
        min-width: 520px; max-width: 1080px;
        padding: 18px 28px;
        background: rgba(8, 15, 30, 0.94);
        border: 1.5px solid rgba(16, 185, 129, 0.6);
        border-radius: 14px;
        color: #f1f5f9;
        font: 700 22px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.22) inset;
        opacity: 0;
        transition: opacity 420ms ease;
        pointer-events: none;
      }
      #ppca-caption.show { opacity: 1; }
      #ppca-caption .step {
        display: block;
        font: 800 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0.22em;
        color: #6ee7b7;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      #ppca-title {
        position: fixed; z-index: 2147483647; inset: 0;
        background: radial-gradient(circle at 50% 45%, rgba(6,78,59,0.93), rgba(2,6,23,0.98));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #f8fafc; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0; transition: opacity 500ms ease;
      }
      #ppca-title.show { opacity: 1; }
      #ppca-title h1 { font-size: 48px; font-weight: 800; margin: 0 0 18px; letter-spacing: -0.01em; }
      #ppca-title h2 { font-size: 22px; font-weight: 500; margin: 0 0 8px; color: #a7f3d0; }
      #ppca-title p  { font-size: 18px; font-weight: 400; max-width: 780px; color: #cbd5e1; margin: 24px 16px 0; line-height: 1.55; }
      .ppca-spot {
        outline: 3px solid #34d399 !important;
        outline-offset: 6px;
        border-radius: 16px !important;
        box-shadow: 0 0 0 8px rgba(16,185,129,0.32), 0 22px 60px rgba(52,211,153,0.3) !important;
        animation: ppcaPulse 1.8s ease-in-out infinite;
      }
      @keyframes ppcaPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(16,185,129,0.28), 0 12px 32px rgba(52,211,153,0.24); }
        50%     { box-shadow: 0 0 0 16px rgba(16,185,129,0.1),  0 24px 64px rgba(52,211,153,0.44); }
      }
    `,
  });
}

async function showTitleCard(page, title, subtitle, body, ms) {
  await page.evaluate(({ title, subtitle, body }) => {
    document.getElementById('ppca-title')?.remove();
    const el = document.createElement('div');
    el.id = 'ppca-title';
    el.innerHTML = `<h2>${subtitle}</h2><h1>${title}</h1><p>${body}</p>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
  }, { title, subtitle, body });
  await page.waitForTimeout(ms);
  await page.evaluate(() => {
    const el = document.getElementById('ppca-title');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 500);
  });
  await page.waitForTimeout(500);
}

async function showCaption(page, step, text) {
  await page.evaluate(({ step, text }) => {
    let el = document.getElementById('ppca-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ppca-caption';
      document.body.appendChild(el);
    }
    el.innerHTML = `<span class="step">${step}</span>${text}`;
    requestAnimationFrame(() => el.classList.add('show'));
  }, { step, text });
}

async function hideCaption(page) {
  await page.evaluate(() => {
    document.getElementById('ppca-caption')?.classList.remove('show');
  });
}

async function spotlight(page, locator) {
  const handle = await locator.elementHandle();
  if (!handle) return;
  await page.evaluate((el) => el?.classList.add('ppca-spot'), handle);
}

async function unspotlight(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.ppca-spot').forEach((el) => el.classList.remove('ppca-spot'));
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

  page.on('request', (request) => {
    if (request.url().includes('/api/role-room/agent/page-content-inspect')) {
      const headers = request.headers();
      log(`→ page-content-inspect request: auth=${headers['authorization'] ? headers['authorization'].slice(0, 40) + '…' : '(none)'} x-session=${headers['x-session-token'] || '(none)'}`);
    }
  });

  page.on('response', async (response) => {
    if (response.url().includes('/api/role-room/agent/page-content-inspect')) {
      log(`← page-content-inspect status=${response.status()}`);
      try {
        const body = await response.json();
        log(`  success=${body?.success} posts=${body?.posts?.length ?? 0} videos=${body?.videos?.length ?? 0} resolvedTo=${body?.meta?.resolvedTo}`);
        if (body?.error) log(`  error=${body.error}`);
      } catch { /* ignore */ }
    }
  });

  try {
    log(`Opening ${APP_URL} — waiting for admin login + navigation to producer panel (up to 600s)`);
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    log('Login flow + navigate to the producer project panel so the "The Role Room Agent" button is visible.');

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

    const pageContentTab = page.getByRole('tab', { name: /Page Content/i }).first();
    await pageContentTab.waitFor({ state: 'visible', timeout: 15_000 });
    await pageContentTab.click();
    log('✓ Clicked Page Content tab.');

    const rootSelector = '[data-testid="page-content-inspector-root"]';
    try {
      await page.waitForSelector(rootSelector, { state: 'visible', timeout: 20_000 });
    } catch {
      const info = await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        hasRoot: !!document.querySelector('[data-testid="page-content-inspector-root"]'),
        tabs: Array.from(document.querySelectorAll('[role="tab"]')).map((t) => t.textContent?.slice(0, 40)),
      }));
      log(`page state at timeout: ${JSON.stringify(info, null, 2)}`);
      throw new Error('Inspector-tab rendret ikke innholdet etter klikk.');
    }
    log('✓ Inspector rendered inside the dialog.');

    await installStyles(page);
    await showTitleCard(
      page,
      'Page Public Content Access',
      'CreatorHub One — Meta App Review Demo',
      'This screencast shows CreatorHub One calling the Meta Graph API to retrieve the 5 most recent public posts and videos of a Facebook Page, rendered inside our Producer workflow so content creators can skim a reference brand\'s cadence, topics and attachments before shaping their own post.',
      7000,
    );
    await beat(page, 600);

    await showCaption(page, 'Step 1 of 3', 'The Page Public Content inspector is shown. The producer pastes the target Facebook Page URL.');
    await beat(page, 3000);

    const inputEl = page.locator('[data-testid="page-content-input"]');
    await inputEl.click();
    await inputEl.fill('');
    await beat(page, 400);
    await inputEl.type(PAGE_URL, { delay: 40 });
    await beat(page, 1200);

    await showCaption(page, 'Step 2 of 3', 'CreatorHub One calls GET /{page-id}/posts and GET /{page-id}/videos on Meta Graph API with "pages_read_engagement" scope and the Page Public Content Access feature.');
    await beat(page, 3200);

    await page.locator('[data-testid="page-content-submit"]').click();

    const resultLocator = page.locator('[data-testid="page-content-result"]');
    let rendered = false;
    try {
      await resultLocator.waitFor({ state: 'visible', timeout: 30_000 });
      rendered = true;
    } catch {
      log('⚠ Result did not render in 30s. Continuing recording so reviewer sees the current state.');
    }

    await beat(page, 1500);
    await showCaption(page, 'Step 3 of 3', 'The recent posts and videos returned by Meta Graph API are rendered as two scannable lists inside CreatorHub One.');
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
      'Page Public Content → Reference Brand Research',
      'Use case',
      'CreatorHub One requests Page Public Content Access only to retrieve and display a Facebook Page\'s recent public posts and videos for reference-brand research inside the Producer workflow. No private user data is read. Access tokens are stored encrypted and scoped to the admin who connected their Meta account.',
      7000,
    );

    log('Demo complete — closing context to flush video.');
  } catch (error) {
    console.error('Script failed:', error?.message ?? error);
    await page.screenshot({ path: path.join(VIDEO_DIR, `ppca-failure-${Date.now()}.png`), fullPage: true }).catch(() => {});
    if (!HEADLESS) await page.waitForTimeout(30_000);
    process.exitCode = 2;
  } finally {
    await context.close();
    const videoPath = await page.video()?.path();
    if (videoPath) {
      const finalName = path.join(VIDEO_DIR, `ppca-demo-${Date.now()}.webm`);
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
