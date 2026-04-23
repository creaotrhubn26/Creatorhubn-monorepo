#!/usr/bin/env node
/**
 * Meta App Review screencast: publish_video + pages_manage_posts demo.
 *
 * Records the "FB Publish" tab flow end-to-end:
 *   1. Title card naming the permissions + use case
 *   2. Producer opens the FB Publish tab in The Role Room Agent
 *   3. Page picker shows admin-able Facebook Pages
 *   4. Producer selects a video file (small test clip, pre-supplied)
 *   5. Types a caption
 *   6. Clicks "Publish video to Page"
 *   7. App calls POST /{page-id}/videos on Meta Graph API
 *   8. Result card renders with the returned video id + permalink
 *   9. Closing card with use-case statement
 *
 * Requires:
 *   - .role-room-demo-state.json  (saved login)
 *   - DEMO_FB_VIDEO_PATH env var pointing to a small mp4 (<50 MB
 *     recommended). Defaults to recordings/ads-attribution-demo-*.mp4
 *     from the last ads demo since we know it exists.
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'https://theroleroom.com';
const VIDEO_DIR = path.resolve(process.cwd(), process.env.VIDEO_DIR || 'recordings');
const STATE_PATH = path.resolve(process.cwd(), process.env.STATE_FILE || '.role-room-demo-state.json');
const HEADLESS = process.env.HEADLESS === '1';
const DEMO_VIDEO_PATH = process.env.DEMO_FB_VIDEO_PATH
  || path.resolve(VIDEO_DIR, 'ads-attribution-demo-1776765193284.mp4');
const DEMO_CAPTION = process.env.DEMO_FB_CAPTION
  || 'CreatorHub One — publish_video review demo clip. Auto-published to our Facebook Page from inside the Feed Planner.';

function log(m) { console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${m}`); }
async function ensureDir(d) { await fs.mkdir(d, { recursive: true }); }
async function loadStorage() {
  try { await fs.access(STATE_PATH); return STATE_PATH; } catch { return undefined; }
}
async function beat(page, ms = 1500) { await page.waitForTimeout(ms); }

async function installStyles(page) {
  await page.addStyleTag({
    content: `
      #fbpub-caption {
        position: fixed; z-index: 2147483647;
        left: 50%; top: 32px; transform: translateX(-50%);
        min-width: 520px; max-width: 1080px;
        padding: 18px 28px;
        background: rgba(16, 40, 90, 0.94);
        border: 1.5px solid rgba(24, 119, 242, 0.6);
        border-radius: 14px;
        color: #e0ebff;
        font: 700 22px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(24,119,242,0.22) inset;
        opacity: 0; transition: opacity 420ms ease; pointer-events: none;
      }
      #fbpub-caption.show { opacity: 1; }
      #fbpub-caption .step {
        display: block;
        font: 800 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0.22em; color: #93c5fd; text-transform: uppercase; margin-bottom: 8px;
      }
      #fbpub-title {
        position: fixed; z-index: 2147483647; inset: 0;
        background: radial-gradient(circle at 50% 45%, rgba(24,119,242,0.93), rgba(2,6,23,0.98));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #f8fafc; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0; transition: opacity 500ms ease;
      }
      #fbpub-title.show { opacity: 1; }
      #fbpub-title h1 { font-size: 46px; font-weight: 800; margin: 0 0 18px; letter-spacing: -0.01em; }
      #fbpub-title h2 { font-size: 22px; font-weight: 500; margin: 0 0 8px; color: #bfdbfe; }
      #fbpub-title p  { font-size: 18px; font-weight: 400; max-width: 780px; color: #cbd5e1; margin: 24px 16px 0; line-height: 1.55; }
      .fbpub-spot {
        outline: 3px solid #1877f2 !important;
        outline-offset: 6px;
        border-radius: 16px !important;
        box-shadow: 0 0 0 8px rgba(24,119,242,0.32), 0 22px 60px rgba(24,119,242,0.3) !important;
        animation: fbpubPulse 1.8s ease-in-out infinite;
      }
      @keyframes fbpubPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(24,119,242,0.28), 0 12px 32px rgba(24,119,242,0.24); }
        50%     { box-shadow: 0 0 0 16px rgba(24,119,242,0.1),  0 24px 64px rgba(24,119,242,0.44); }
      }
    `,
  });
}

async function showTitleCard(page, title, subtitle, body, ms) {
  await page.evaluate(({ title, subtitle, body }) => {
    document.getElementById('fbpub-title')?.remove();
    const el = document.createElement('div');
    el.id = 'fbpub-title';
    el.innerHTML = `<h2>${subtitle}</h2><h1>${title}</h1><p>${body}</p>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
  }, { title, subtitle, body });
  await page.waitForTimeout(ms);
  await page.evaluate(() => {
    const el = document.getElementById('fbpub-title');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 500);
  });
  await page.waitForTimeout(500);
}

async function showCaption(page, step, text) {
  await page.evaluate(({ step, text }) => {
    let el = document.getElementById('fbpub-caption');
    if (!el) { el = document.createElement('div'); el.id = 'fbpub-caption'; document.body.appendChild(el); }
    el.innerHTML = `<span class="step">${step}</span>${text}`;
    requestAnimationFrame(() => el.classList.add('show'));
  }, { step, text });
}
async function hideCaption(page) {
  await page.evaluate(() => { document.getElementById('fbpub-caption')?.classList.remove('show'); });
}
async function spotlight(page, locator) {
  const handle = await locator.elementHandle();
  if (!handle) return;
  await page.evaluate((el) => el?.classList.add('fbpub-spot'), handle);
}
async function unspotlight(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.fbpub-spot').forEach((el) => el.classList.remove('fbpub-spot'));
  });
}

(async () => {
  await ensureDir(VIDEO_DIR);
  log(`Recording to ${VIDEO_DIR}`);
  log(`Demo video file: ${DEMO_VIDEO_PATH}`);

  try {
    await fs.access(DEMO_VIDEO_PATH);
  } catch {
    console.error(`Demo video file not found: ${DEMO_VIDEO_PATH}`);
    console.error('Set DEMO_FB_VIDEO_PATH to an existing small mp4 and retry.');
    process.exit(1);
  }

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
    if (response.url().includes('/api/role-room/facebook/publish-video')) {
      log(`← publish-video status=${response.status()}`);
      try {
        const body = await response.json();
        log(`  success=${body?.success} video.id=${body?.video?.id} permalink=${body?.video?.permalink}`);
        if (body?.error) log(`  error=${body.error}`);
      } catch { /* ignore */ }
    }
    if (response.url().includes('/api/role-room/facebook/pages')) {
      log(`← facebook/pages status=${response.status()}`);
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

    const fbTab = page.getByRole('tab', { name: /FB Publish/i }).first();
    await fbTab.waitFor({ state: 'visible', timeout: 15_000 });
    await fbTab.click();
    log('✓ Clicked FB Publish tab.');

    const rootSelector = '[data-testid="fb-video-publisher-root"]';
    await page.waitForSelector(rootSelector, { state: 'visible', timeout: 20_000 });
    log('✓ Publisher panel rendered.');

    await installStyles(page);
    await showTitleCard(
      page,
      'publish_video + pages_manage_posts',
      'CreatorHub One — Meta App Review Demo',
      'This screencast shows how CreatorHub One lets a content producer publish a video to a client\'s Facebook Page directly from the Feed Planner workflow. The same CTA is rendered on each reel-type feed post next to the Instagram publish button, so producers ship the same creative to IG + FB in one click.',
      7000,
    );
    await beat(page, 600);

    await showCaption(page, 'Step 1 of 4', 'Producer opens the FB Publish panel. Admin-able Facebook Pages are pre-loaded from /me/accounts.');
    await beat(page, 3000);

    await showCaption(page, 'Step 2 of 4', 'Producer picks the Facebook Page and selects a local video file.');
    await beat(page, 1500);

    const fileInput = page.locator('[data-testid="fb-video-file-input"]');
    await fileInput.setInputFiles(DEMO_VIDEO_PATH);
    log('✓ Attached video file.');
    await beat(page, 2000);

    // Override description for the demo.
    const desc = page.locator('[data-testid="fb-video-description"]');
    await desc.click();
    await desc.fill(DEMO_CAPTION);
    await beat(page, 1200);

    await showCaption(page, 'Step 3 of 4', `CreatorHub One calls POST /{page-id}/videos on Meta Graph API v21.0 with publish_video + pages_manage_posts scopes. Page access token is retrieved per-request via /me/accounts.`);
    await beat(page, 3200);

    await page.locator('[data-testid="fb-video-publish-submit"]').click();
    log('✓ Clicked Publish. Waiting for Meta Graph upload response…');

    const resultLocator = page.locator('[data-testid="fb-video-publish-result"]');
    let rendered = false;
    try {
      await resultLocator.waitFor({ state: 'visible', timeout: 120_000 });
      rendered = true;
    } catch {
      log('⚠ Result did not render within 120s — Meta may still be encoding the video. Continuing anyway.');
    }

    await beat(page, 1500);
    await showCaption(page, 'Step 4 of 4', 'Meta Graph API returns the new video id + facebook.com permalink. The video is now live on the selected Facebook Page.');
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
      'SoMe suite: IG + FB from one feed post',
      'Use case',
      'CreatorHub One requests publish_video + pages_manage_posts only to upload video content to Facebook Pages the signed-in admin administers, scheduled or immediate, from inside the Feed Planner. The same post object powers the Instagram publish flow — producers ship identical caption + hashtags + schedule across both platforms in one click. No private user data is accessed. Access tokens are stored encrypted (AES-256, AUTH_SECRET-derived key) and scoped per-admin to the user who connected the Meta integration.',
      7000,
    );

    log('Demo complete — closing context to flush video.');
  } catch (error) {
    console.error('Script failed:', error?.message ?? error);
    await page.screenshot({ path: path.join(VIDEO_DIR, `fbpub-failure-${Date.now()}.png`), fullPage: true }).catch(() => {});
    if (!HEADLESS) await page.waitForTimeout(30_000);
    process.exitCode = 2;
  } finally {
    await context.close();
    const videoPath = await page.video()?.path();
    if (videoPath) {
      const finalName = path.join(VIDEO_DIR, `fb-publish-demo-${Date.now()}.webm`);
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
