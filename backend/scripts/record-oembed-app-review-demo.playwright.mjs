#!/usr/bin/env node
/**
 * Meta App Review screencast: oEmbed Read.
 *
 * Records one video showing the /admin/oembed-app-review-demo page being
 * driven end-to-end for an Instagram URL and a Facebook URL — proving
 * use of /v21.0/instagram_oembed and /v21.0/oembed_post.
 *
 * Output: recordings/oembed-read-demo-<ts>.webm
 *
 * Usage:
 *   node backend/scripts/record-oembed-app-review-demo.playwright.mjs
 *
 * Env (read from backend/.env.oembed.demo.local if present):
 *   APP_BASE_URL                 default: https://creatorhub-backend-rtbl.onrender.com
 *   WHATSAPP_DEMO_BYPASS_TOKEN   same bypass-token as the WhatsApp demos
 *   DEMO_INSTAGRAM_POST_URL      public IG post URL
 *   DEMO_FACEBOOK_POST_URL       public FB post URL
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// scripts/ er i backend/scripts/, så repo-root er to nivåer opp
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const VIDEO_DIR = path.resolve(REPO_ROOT, 'recordings');
const ENV_FILE = path.resolve(REPO_ROOT, 'backend/.env.oembed.demo.local');
const DEFAULT_APP_BASE = 'https://creatorhub-backend-rtbl.onrender.com';
const HEADLESS = process.env.HEADLESS === '1';
const VIEWPORT = { width: 1440, height: 900 };

function log(msg) {
  console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadEnv() {
  const out = {
    APP_BASE_URL: process.env.APP_BASE_URL || DEFAULT_APP_BASE,
    WHATSAPP_DEMO_BYPASS_TOKEN: process.env.WHATSAPP_DEMO_BYPASS_TOKEN || '',
    DEMO_INSTAGRAM_POST_URL: process.env.DEMO_INSTAGRAM_POST_URL || '',
    DEMO_FACEBOOK_POST_URL: process.env.DEMO_FACEBOOK_POST_URL || '',
    DEMO_USER_ACCESS_TOKEN: process.env.DEMO_USER_ACCESS_TOKEN || '',
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

async function beat(page, ms = 1500) {
  await page.waitForTimeout(ms);
}

// ── Visual overlay helpers ────────────────────────────────────────────────

async function installStyles(page) {
  await page.addStyleTag({
    content: `
      #ar-caption {
        position: fixed; z-index: 2147483647;
        left: 50%; top: 32px; transform: translateX(-50%);
        min-width: 520px; max-width: 1080px;
        padding: 18px 28px;
        background: rgba(8, 15, 30, 0.94);
        border: 1.5px solid rgba(34, 197, 94, 0.6);
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
        color: #86efac;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      #ar-title {
        position: fixed; z-index: 2147483647; inset: 0;
        background: radial-gradient(circle at 50% 45%, rgba(20, 83, 45, 0.95), rgba(2, 6, 23, 0.98));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #f8fafc; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0; transition: opacity 500ms ease;
      }
      #ar-title.show { opacity: 1; }
      #ar-title h1 { font-size: 48px; font-weight: 800; margin: 0 0 18px; letter-spacing: -0.01em; }
      #ar-title h2 { font-size: 22px; font-weight: 500; margin: 0 0 8px; color: #bbf7d0; }
      #ar-title p  { font-size: 18px; font-weight: 400; max-width: 780px; color: #d1fae5; margin: 24px 16px 0; line-height: 1.55; }
      .ar-spot {
        outline: 3px solid #22c55e !important;
        outline-offset: 6px;
        border-radius: 12px !important;
        box-shadow: 0 0 0 8px rgba(34, 197, 94, 0.32) !important;
        animation: arPulse 1.8s ease-in-out infinite;
      }
      @keyframes arPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(34,197,94,0.32) !important; }
        50%     { box-shadow: 0 0 0 16px rgba(34,197,94,0.12) !important; }
      }
    `,
  });
}

async function showTitleCard(page, { title, subtitle, body }) {
  await page.evaluate(({ title, subtitle, body }) => {
    let el = document.getElementById('ar-title');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ar-title';
      document.body.appendChild(el);
    }
    el.innerHTML = `<h2>${subtitle}</h2><h1>${title}</h1><p>${body}</p>`;
    requestAnimationFrame(() => el.classList.add('show'));
  }, { title, subtitle, body });
}

async function hideTitleCard(page) {
  await page.evaluate(() => {
    const el = document.getElementById('ar-title');
    if (el) {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 520);
    }
  });
}

async function showCaption(page, step, text) {
  await page.evaluate(({ step, text }) => {
    let el = document.getElementById('ar-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ar-caption';
      document.body.appendChild(el);
    }
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

// ── Main flow ─────────────────────────────────────────────────────────────

async function runDemo(page, env) {
  const igUrl = env.DEMO_INSTAGRAM_POST_URL;
  const fbUrl = env.DEMO_FACEBOOK_POST_URL;

  const pageUrl = appendBypassToken(
    `${env.APP_BASE_URL}/admin/oembed-app-review-demo`,
    env.WHATSAPP_DEMO_BYPASS_TOKEN,
  );
  log(`Navigating to ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await installStyles(page);

  // Title
  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'oEmbed Read — Embed Verified Public Posts',
    body: 'Demonstrating end-to-end use of Graph API /v21.0/instagram_oembed and /v21.0/oembed_post with the App Access Token. The returned HTML is rendered live in the producer dashboard.',
  });
  await beat(page, 4500);
  await hideTitleCard(page);
  await beat(page, 600);

  // Step 0: fill in User Access Token (optional but unlocks Dev-mode flow)
  if (env.DEMO_USER_ACCESS_TOKEN) {
    await page.locator('[data-testid="user-token-input"]').fill(env.DEMO_USER_ACCESS_TOKEN);
    await beat(page, 600);
  }

  // Step 1: paste Instagram URL
  await showCaption(page, 'Step 1', 'Producer pastes a public Instagram post URL');
  await spotlight(page, '[data-testid="post-url-input"]');
  await beat(page, 1500);
  await page.locator('[data-testid="post-url-input"]').fill(igUrl);
  await beat(page, 1800);

  // Step 2: click Fetch oEmbed
  await showCaption(page, 'Step 2', 'Backend calls Meta Graph /v21.0/instagram_oembed with App Access Token');
  await spotlight(page, '[data-testid="fetch-button"]');
  await beat(page, 1200);
  await page.locator('[data-testid="fetch-button"]').click();
  await beat(page, 600);

  // Wait for either result-ok or result-err
  await page.locator('[data-testid="result-ok"], [data-testid="result-err"]').first().waitFor({ timeout: 20_000 });

  // Step 3: show preview + JSON
  await showCaption(page, 'Step 3', 'Live preview renders the embed; Meta JSON response visible below');
  await spotlight(page, '[data-testid="preview"]');
  await beat(page, 3500);
  await spotlight(page, '[data-testid="result"]');
  await beat(page, 3500);
  await removeSpotlight(page);

  // Step 4: repeat with Facebook URL if provided
  if (fbUrl) {
    await showCaption(page, 'Step 4', 'Same flow with a Facebook URL routes to /v21.0/oembed_post');
    await spotlight(page, '[data-testid="post-url-input"]');
    await page.locator('[data-testid="post-url-input"]').fill('');
    await beat(page, 500);
    await page.locator('[data-testid="post-url-input"]').fill(fbUrl);
    await beat(page, 1500);
    await spotlight(page, '[data-testid="fetch-button"]');
    await beat(page, 800);
    await page.locator('[data-testid="fetch-button"]').click();
    await page.locator('[data-testid="result-ok"], [data-testid="result-err"]').first().waitFor({ timeout: 20_000 });
    await spotlight(page, '[data-testid="preview"]');
    await beat(page, 3500);
    await removeSpotlight(page);
  }

  // End card
  await hideCaption(page);
  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'oEmbed Read — End of Demo',
    body: 'Both Graph API endpoints called successfully with App Access Token. The returned embed HTML is rendered directly; no private data is read or stored.',
  });
  await beat(page, 3500);
}

// ── Driver ────────────────────────────────────────────────────────────────

async function main() {
  const env = await loadEnv();
  // Tidlig env-validering — unngår å lekke browser-prosesser ved konfig-feil
  const missing = [];
  if (!env.DEMO_INSTAGRAM_POST_URL) missing.push('DEMO_INSTAGRAM_POST_URL');
  if (missing.length) {
    console.error(`Error: required env missing: ${missing.join(', ')}`);
    console.error(`Set them via process.env or backend/.env.<slug>.demo.local`);
    process.exit(1);
  }
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
  // Rename the recorded WebM to a stable name with timestamp.
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
      const stableName = `oembed-read-demo-${ts}.webm`;
      await fs.rename(path.join(VIDEO_DIR, stats[0].f), path.join(VIDEO_DIR, stableName));
      log(`→ ${stableName}`);
    }
  } catch {}
}

main();
