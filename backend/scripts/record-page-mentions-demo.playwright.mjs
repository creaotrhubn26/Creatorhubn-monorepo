#!/usr/bin/env node
/**
 * Meta App Review screencast: Page Mentions demo.
 *
 * Records the Page Mentions inspector flow end-to-end:
 *   1. Title card naming the feature + use case
 *   2. Producer picks an author Facebook Page they admin
 *   3. Writes a post body
 *   4. Enters the numeric Page ID of the Page to mention
 *   5. App POSTs /{page-id}/feed with "<message> @[PAGE_ID]"
 *   6. Result card shows the new post_id + Graph permalink
 *   7. Closing card with use-case statement
 *
 * Required env:
 *   DEMO_MENTION_PAGE_ID — numeric Facebook Page ID to mention
 *
 * Optional env:
 *   APP_URL / VIDEO_DIR / STATE_FILE / HEADLESS — same as other demos.
 *
 * Requires .role-room-demo-state.json from an earlier admin-login run.
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'https://theroleroom.com';
const VIDEO_DIR = path.resolve(process.cwd(), process.env.VIDEO_DIR || 'recordings');
const STATE_PATH = path.resolve(process.cwd(), process.env.STATE_FILE || '.role-room-demo-state.json');
const HEADLESS = process.env.HEADLESS === '1';
const MENTION_PAGE_ID = process.env.DEMO_MENTION_PAGE_ID || '';
const POST_MESSAGE = process.env.DEMO_POST_MESSAGE
  || 'Takk for godt samarbeid — Page Mention-demo for CreatorHub One (Meta App Review).';

if (!MENTION_PAGE_ID || !/^[0-9]{3,}$/.test(MENTION_PAGE_ID)) {
  console.error('Set DEMO_MENTION_PAGE_ID to the numeric Facebook Page ID you want to mention.');
  console.error('Example: DEMO_MENTION_PAGE_ID=113187348710914 node backend/scripts/record-page-mentions-demo.playwright.mjs');
  process.exit(1);
}

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
      #pgm-caption {
        position: fixed; z-index: 2147483647;
        left: 50%; top: 32px; transform: translateX(-50%);
        min-width: 520px; max-width: 1080px;
        padding: 18px 28px;
        background: rgba(8, 15, 30, 0.94);
        border: 1.5px solid rgba(168, 85, 247, 0.6);
        border-radius: 14px;
        color: #f1f5f9;
        font: 700 22px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(168,85,247,0.22) inset;
        opacity: 0;
        transition: opacity 420ms ease;
        pointer-events: none;
      }
      #pgm-caption.show { opacity: 1; }
      #pgm-caption .step {
        display: block;
        font: 800 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0.22em;
        color: #d8b4fe;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      #pgm-title {
        position: fixed; z-index: 2147483647; inset: 0;
        background: radial-gradient(circle at 50% 45%, rgba(76,29,149,0.93), rgba(2,6,23,0.98));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #f8fafc; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0; transition: opacity 500ms ease;
      }
      #pgm-title.show { opacity: 1; }
      #pgm-title h1 { font-size: 48px; font-weight: 800; margin: 0 0 18px; letter-spacing: -0.01em; }
      #pgm-title h2 { font-size: 22px; font-weight: 500; margin: 0 0 8px; color: #e9d5ff; }
      #pgm-title p  { font-size: 18px; font-weight: 400; max-width: 780px; color: #cbd5e1; margin: 24px 16px 0; line-height: 1.55; }
      .pgm-spot {
        outline: 3px solid #c084fc !important;
        outline-offset: 6px;
        border-radius: 16px !important;
        box-shadow: 0 0 0 8px rgba(168,85,247,0.32), 0 22px 60px rgba(192,132,252,0.3) !important;
        animation: pgmPulse 1.8s ease-in-out infinite;
      }
      @keyframes pgmPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(168,85,247,0.28), 0 12px 32px rgba(192,132,252,0.24); }
        50%     { box-shadow: 0 0 0 16px rgba(168,85,247,0.1),  0 24px 64px rgba(192,132,252,0.44); }
      }
    `,
  });
}

async function showTitleCard(page, title, subtitle, body, ms) {
  await page.evaluate(({ title, subtitle, body }) => {
    document.getElementById('pgm-title')?.remove();
    const el = document.createElement('div');
    el.id = 'pgm-title';
    el.innerHTML = `<h2>${subtitle}</h2><h1>${title}</h1><p>${body}</p>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
  }, { title, subtitle, body });
  await page.waitForTimeout(ms);
  await page.evaluate(() => {
    const el = document.getElementById('pgm-title');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 500);
  });
  await page.waitForTimeout(500);
}

async function showCaption(page, step, text) {
  await page.evaluate(({ step, text }) => {
    let el = document.getElementById('pgm-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pgm-caption';
      document.body.appendChild(el);
    }
    el.innerHTML = `<span class="step">${step}</span>${text}`;
    requestAnimationFrame(() => el.classList.add('show'));
  }, { step, text });
}

async function hideCaption(page) {
  await page.evaluate(() => {
    document.getElementById('pgm-caption')?.classList.remove('show');
  });
}

async function spotlight(page, locator) {
  const handle = await locator.elementHandle();
  if (!handle) return;
  await page.evaluate((el) => el?.classList.add('pgm-spot'), handle);
}

async function unspotlight(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.pgm-spot').forEach((el) => el.classList.remove('pgm-spot'));
  });
}

(async () => {
  await ensureDir(VIDEO_DIR);
  log(`Recording to ${VIDEO_DIR}`);
  log(`Mentioning Page ID: ${MENTION_PAGE_ID}`);

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

  page.on('response', async (response) => {
    if (response.url().includes('/api/role-room/facebook/publish-page-post')) {
      log(`← publish-page-post status=${response.status()}`);
      try {
        const body = await response.json();
        log(`  success=${body?.success} post.id=${body?.post?.id} mentioned=${body?.post?.mentionedPageId}`);
        if (body?.error) log(`  error=${body.error}`);
      } catch { /* ignore */ }
    }
  });

  try {
    log(`Opening ${APP_URL} — waiting for admin login + navigation to producer panel (up to 600s)`);
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    log('Log in + navigate to the producer project panel so the "The Role Room Agent" button is visible.');

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

    const mentionTab = page.getByRole('tab', { name: /Page Mentions/i }).first();
    await mentionTab.waitFor({ state: 'visible', timeout: 15_000 });
    await mentionTab.click();
    log('✓ Clicked Page Mentions tab.');

    const rootSelector = '[data-testid="fb-page-mention-root"]';
    try {
      await page.waitForSelector(rootSelector, { state: 'visible', timeout: 20_000 });
    } catch {
      throw new Error('Inspector-tab rendret ikke innholdet etter klikk.');
    }
    log('✓ Inspector rendered inside the dialog.');

    await installStyles(page);
    await showTitleCard(
      page,
      'Page Mentions',
      'CreatorHub One — Meta App Review Demo',
      'This screencast shows CreatorHub One publishing a Facebook Page post that mentions another Page via Meta Graph API. The producer picks the author Page, writes the post body, supplies the numeric Page ID of the Page to mention, and the app POSTs /{page-id}/feed with the documented @[PAGE_ID] in-line mention syntax.',
      7000,
    );
    await beat(page, 500);

    await showCaption(page, 'Step 1 of 4', 'The producer picks one of their own Facebook Pages as the author of the post.');
    await beat(page, 2800);

    // The Author Page select is populated from /me/accounts; first option is picked by default.
    const authorSelect = page.locator('[data-testid="fb-mention-author-page"]').first();
    await authorSelect.scrollIntoViewIfNeeded().catch(() => {});
    await spotlight(page, authorSelect);
    await beat(page, 2200);
    await unspotlight(page);

    await showCaption(page, 'Step 2 of 4', 'Producer writes the post message.');
    await beat(page, 1800);

    const messageField = page.locator('[data-testid="fb-mention-message"]').first();
    await messageField.click();
    await messageField.fill(POST_MESSAGE);
    await beat(page, 1200);

    await showCaption(page, 'Step 3 of 4', `Producer supplies the numeric Facebook Page ID (${MENTION_PAGE_ID}) of the Page to mention.`);
    await beat(page, 2200);

    const mentionField = page.locator('[data-testid="fb-mention-target-id"]').first();
    await mentionField.click();
    await mentionField.fill('');
    await mentionField.type(MENTION_PAGE_ID, { delay: 35 });
    await beat(page, 1200);

    // Preview shows the `@[PAGE_ID]` appended to the message.
    const preview = page.locator('[data-testid="fb-mention-preview"]').first();
    await preview.scrollIntoViewIfNeeded().catch(() => {});
    await spotlight(page, preview);
    await beat(page, 2800);
    await unspotlight(page);

    await showCaption(page, 'Step 4 of 4', 'Publish — backend POSTs /{page-id}/feed with the @[PAGE_ID] mention; Meta renders it as a clickable Page mention.');
    await beat(page, 2400);

    await page.locator('[data-testid="fb-mention-submit"]').click();

    const result = page.locator('[data-testid="fb-mention-result"]').first();
    let published = false;
    try {
      await result.waitFor({ state: 'visible', timeout: 45_000 });
      published = true;
    } catch {
      log('⚠ Publish did not succeed in 45s — continuing so reviewer sees the current state.');
    }
    await beat(page, 1200);

    if (published) {
      await result.scrollIntoViewIfNeeded();
      await spotlight(page, result);
      await beat(page, 9000);
      await unspotlight(page);
      await beat(page, 800);
    } else {
      await beat(page, 4000);
    }

    await hideCaption(page);
    await beat(page, 500);
    await showTitleCard(
      page,
      'Page Mentions → partner/supplier credits',
      'Use case',
      'CreatorHub One uses Page Mentions so producers can credit partner Pages, suppliers, venues, and collaborators in client Page posts — e.g. a bakery thanking its flour supplier, or a studio crediting a stylist agency. The mention syntax is user-controlled and only applied when the producer explicitly supplies a target Page ID. No private data is read; access tokens are stored encrypted and scoped to the admin.',
      7500,
    );

    log('Demo complete — closing context to flush video.');
  } catch (error) {
    console.error('Script failed:', error?.message ?? error);
    await page.screenshot({ path: path.join(VIDEO_DIR, `pgm-failure-${Date.now()}.png`), fullPage: true }).catch(() => {});
    if (!HEADLESS) await page.waitForTimeout(30_000);
    process.exitCode = 2;
  } finally {
    await context.close();
    const videoPath = await page.video()?.path();
    if (videoPath) {
      const finalName = path.join(VIDEO_DIR, `page-mentions-demo-${Date.now()}.webm`);
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
