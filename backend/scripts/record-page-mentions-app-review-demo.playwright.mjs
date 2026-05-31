#!/usr/bin/env node
/**
 * Meta App Review screencast: Page Mentions.
 *
 * Records one video showing the /admin/page-mentions-app-review-demo
 * page being driven end-to-end:
 *   1. Producer pastes a production-team Page ID
 *   2. Click "Fetch mentions" → backend calls /v21.0/{page-id}/tagged
 *   3. Mention-cards render with from-Page name, message, engagement counts
 *
 * Output: recordings/page-mentions-demo-<ts>.webm
 *
 * Env (read from backend/.env.page-mentions.demo.local if present):
 *   APP_BASE_URL                 default: https://creatorhub-backend-rtbl.onrender.com
 *   WHATSAPP_DEMO_BYPASS_TOKEN   bypass-token (same as oEmbed/CTA submissions)
 *   DEMO_PAGE_ID                 Page ID to inspect for mentions
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(process.cwd());
const VIDEO_DIR = path.resolve(REPO_ROOT, 'recordings');
const ENV_FILE = path.resolve(REPO_ROOT, 'backend/.env.page-mentions.demo.local');
const DEFAULT_APP_BASE = 'https://creatorhub-backend-rtbl.onrender.com';
const HEADLESS = process.env.HEADLESS === '1';
const VIEWPORT = { width: 1440, height: 900 };

function log(msg) { console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`); }
async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }

async function loadEnv() {
  const out = {
    APP_BASE_URL: process.env.APP_BASE_URL || DEFAULT_APP_BASE,
    WHATSAPP_DEMO_BYPASS_TOKEN: process.env.WHATSAPP_DEMO_BYPASS_TOKEN || '',
    DEMO_PAGE_ID: process.env.DEMO_PAGE_ID || '',
  };
  try {
    const raw = await fs.readFile(ENV_FILE, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const [, k, v] = m;
      if (out[k] !== undefined && !out[k]) out[k] = v.replace(/^['"]|['"]$/g, '').trim();
    }
  } catch {}
  return out;
}

function appendBypassToken(url, token) {
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

async function beat(page, ms = 1500) { await page.waitForTimeout(ms); }

async function installStyles(page) {
  await page.addStyleTag({
    content: `
      #ar-caption {
        position: fixed; z-index: 2147483647;
        left: 50%; top: 32px; transform: translateX(-50%);
        min-width: 520px; max-width: 1080px;
        padding: 18px 28px;
        background: rgba(8, 15, 30, 0.94);
        border: 1.5px solid rgba(251, 191, 36, 0.6);
        border-radius: 14px;
        color: #f1f5f9;
        font: 700 22px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        opacity: 0; transition: opacity 420ms ease;
        pointer-events: none;
      }
      #ar-caption.show { opacity: 1; }
      #ar-caption .step {
        display: block;
        font: 800 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0.22em;
        color: #fde68a;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      #ar-title {
        position: fixed; z-index: 2147483647; inset: 0;
        background: radial-gradient(circle at 50% 45%, rgba(120, 53, 15, 0.95), rgba(2, 6, 23, 0.98));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #f8fafc; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0; transition: opacity 500ms ease;
      }
      #ar-title.show { opacity: 1; }
      #ar-title h1 { font-size: 48px; font-weight: 800; margin: 0 0 18px; letter-spacing: -0.01em; }
      #ar-title h2 { font-size: 22px; font-weight: 500; margin: 0 0 8px; color: #fde68a; }
      #ar-title p  { font-size: 18px; font-weight: 400; max-width: 780px; color: #fef3c7; margin: 24px 16px 0; line-height: 1.55; }
      .ar-spot {
        outline: 3px solid #fbbf24 !important;
        outline-offset: 6px;
        border-radius: 12px !important;
        box-shadow: 0 0 0 8px rgba(251, 191, 36, 0.32) !important;
        animation: arPulse 1.8s ease-in-out infinite;
      }
      @keyframes arPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(251,191,36,0.32) !important; }
        50%     { box-shadow: 0 0 0 16px rgba(251,191,36,0.12) !important; }
      }
    `,
  });
}

async function showTitleCard(page, { title, subtitle, body }) {
  await page.evaluate(({ title, subtitle, body }) => {
    let el = document.getElementById('ar-title');
    if (!el) { el = document.createElement('div'); el.id = 'ar-title'; document.body.appendChild(el); }
    el.innerHTML = `<h2>${subtitle}</h2><h1>${title}</h1><p>${body}</p>`;
    requestAnimationFrame(() => el.classList.add('show'));
  }, { title, subtitle, body });
}

async function hideTitleCard(page) {
  await page.evaluate(() => {
    const el = document.getElementById('ar-title');
    if (el) { el.classList.remove('show'); setTimeout(() => el.remove(), 520); }
  });
}

async function showCaption(page, step, text) {
  await page.evaluate(({ step, text }) => {
    let el = document.getElementById('ar-caption');
    if (!el) { el = document.createElement('div'); el.id = 'ar-caption'; document.body.appendChild(el); }
    el.innerHTML = `<span class="step">${step}</span>${text}`;
    requestAnimationFrame(() => el.classList.add('show'));
  }, { step, text });
}

async function hideCaption(page) {
  await page.evaluate(() => {
    const el = document.getElementById('ar-caption');
    if (el) el.classList.remove('show');
  });
}

async function spotlight(page, selector) {
  await page.evaluate((selector) => {
    document.querySelectorAll('.ar-spot').forEach((el) => el.classList.remove('ar-spot'));
    const target = document.querySelector(selector);
    if (target) target.classList.add('ar-spot');
  }, selector);
}

async function removeSpotlight(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.ar-spot').forEach((el) => el.classList.remove('ar-spot'));
  });
}

async function runDemo(page, env) {
  if (!env.DEMO_PAGE_ID) throw new Error('DEMO_PAGE_ID required');

  const pageUrl = appendBypassToken(
    `${env.APP_BASE_URL}/admin/page-mentions-app-review-demo`,
    env.WHATSAPP_DEMO_BYPASS_TOKEN,
  );
  log(`Navigating to ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await installStyles(page);

  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'Page Mentions — Who\\'s Tagging Your Page',
    body: 'Demonstrating end-to-end use of Graph API GET /v21.0/{page-id}/tagged with the App Access Token. The Role Room surfaces posts tagging production-team Pages so producers can engage in real time — find new collaborators, answer questions, share traffic.',
  });
  await beat(page, 4500);
  await hideTitleCard(page);
  await beat(page, 600);

  await showCaption(page, 'Step 1', 'Producer pastes their production-team Page ID');
  await spotlight(page, '[data-testid="page-id-input"]');
  await beat(page, 1200);
  await page.locator('[data-testid="page-id-input"]').fill(env.DEMO_PAGE_ID);
  await beat(page, 1500);

  await showCaption(page, 'Step 2', 'Backend calls GET /v21.0/{page-id}/tagged with App Access Token');
  await spotlight(page, '[data-testid="fetch-mentions-button"]');
  await beat(page, 1000);
  await page.locator('[data-testid="fetch-mentions-button"]').click();
  await page.locator('[data-testid="mention-card"], [data-testid="mention-empty"], [data-testid="mentions-err"]').first().waitFor({ timeout: 20_000 });
  await spotlight(page, '[data-testid="mentions-result"]');
  await beat(page, 4000);
  await removeSpotlight(page);

  await hideCaption(page);
  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'Page Mentions — End of Demo',
    body: 'Read-only access to posts that tag the Page. Surfaced as a "Who\\'s talking about you"-feed so producers can engage. No private data, no user-token impersonation, no write operations.',
  });
  await beat(page, 3500);
}

async function main() {
  const env = await loadEnv();
  await ensureDir(VIDEO_DIR);
  log(`Recording to ${VIDEO_DIR}`);
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: VIEWPORT,
    recordVideo: { dir: VIDEO_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();
  try {
    await runDemo(page, env);
    log('✓ Recording complete');
  } catch (err) {
    console.error('Recording failed:', err);
    process.exitCode = 1;
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
  try {
    const files = (await fs.readdir(VIDEO_DIR)).filter((f) => f.endsWith('.webm'));
    const stats = await Promise.all(
      files.map(async (f) => {
        try { return { f, t: (await fs.stat(path.join(VIDEO_DIR, f))).mtimeMs }; }
        catch { return { f, t: 0 }; }
      }),
    );
    stats.sort((a, b) => b.t - a.t);
    if (stats.length) {
      const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
      const stableName = `page-mentions-demo-${ts}.webm`;
      await fs.rename(path.join(VIDEO_DIR, stats[0].f), path.join(VIDEO_DIR, stableName));
      log(`→ ${stableName}`);
    }
  } catch {}
}

main();
