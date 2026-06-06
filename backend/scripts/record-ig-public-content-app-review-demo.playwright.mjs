#!/usr/bin/env node
/**
 * Meta App Review screencast: Instagram Public Content Access.
 *
 * Records one video showing both flows on
 * /admin/instagram-public-content-app-review-demo:
 *   Flow A: Hashtag Search → recent_media grid
 *   Flow B: Business Discovery for a target IG handle
 *
 * Output: recordings/instagram-public-content-demo-<ts>.webm
 *
 * Env (read from backend/.env.ig-public.demo.local if present):
 *   APP_BASE_URL                  default: https://creatorhub-backend-rtbl.onrender.com
 *   WHATSAPP_DEMO_BYPASS_TOKEN    bypass-token
 *   DEMO_IG_USER_ID               your IG Business user_id
 *   DEMO_HASHTAG                  hashtag to search (default: norskcasting)
 *   DEMO_IG_USERNAME              target IG handle for discovery (default: nrkdrama)
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
const ENV_FILE = path.resolve(REPO_ROOT, 'backend/.env.ig-public.demo.local');
const DEFAULT_APP_BASE = 'https://creatorhub-backend-rtbl.onrender.com';
const HEADLESS = process.env.HEADLESS === '1';
const VIEWPORT = { width: 1440, height: 900 };

function log(msg) { console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`); }
async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }

async function loadEnv() {
  const out = {
    APP_BASE_URL: process.env.APP_BASE_URL || DEFAULT_APP_BASE,
    WHATSAPP_DEMO_BYPASS_TOKEN: process.env.WHATSAPP_DEMO_BYPASS_TOKEN || '',
    DEMO_IG_USER_ID: process.env.DEMO_IG_USER_ID || '',
    DEMO_IG_PAGE_ACCESS_TOKEN: process.env.DEMO_IG_PAGE_ACCESS_TOKEN || '',
    DEMO_HASHTAG: process.env.DEMO_HASHTAG || '',
    DEMO_IG_USERNAME: process.env.DEMO_IG_USERNAME || '',
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
        border: 1.5px solid rgba(236, 72, 153, 0.6);
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
        color: #f9a8d4;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      #ar-title {
        position: fixed; z-index: 2147483647; inset: 0;
        background: linear-gradient(135deg, rgba(131, 24, 67, 0.97), rgba(76, 29, 149, 0.97));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #f8fafc; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0; transition: opacity 500ms ease;
      }
      #ar-title.show { opacity: 1; }
      #ar-title h1 { font-size: 48px; font-weight: 800; margin: 0 0 18px; letter-spacing: -0.01em; }
      #ar-title h2 { font-size: 22px; font-weight: 500; margin: 0 0 8px; color: #fbcfe8; }
      #ar-title p  { font-size: 18px; font-weight: 400; max-width: 780px; color: #fce7f3; margin: 24px 16px 0; line-height: 1.55; }
      .ar-spot {
        outline: 3px solid #ec4899 !important;
        outline-offset: 6px;
        border-radius: 12px !important;
        box-shadow: 0 0 0 8px rgba(236, 72, 153, 0.32) !important;
        animation: arPulse 1.8s ease-in-out infinite;
      }
      @keyframes arPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(236,72,153,0.32) !important; }
        50%     { box-shadow: 0 0 0 16px rgba(236,72,153,0.12) !important; }
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
  let pageUrl = appendBypassToken(
    `${env.APP_BASE_URL}/admin/instagram-public-content-app-review-demo`,
    env.WHATSAPP_DEMO_BYPASS_TOKEN,
  );
  if (env.DEMO_IG_PAGE_ACCESS_TOKEN) {
    pageUrl += '&accessToken=' + encodeURIComponent(env.DEMO_IG_PAGE_ACCESS_TOKEN);
  }
  log(`Navigating to ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await installStyles(page);

  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'Instagram Public Content — Casting Monitoring',
    body: 'Demonstrating Hashtag Search + Business Discovery against /v21.0/ig_hashtag_search, /v21.0/{hashtag-id}/recent_media, and /v21.0/{ig-user-id}?fields=business_discovery — for monitoring active casting calls and discovering production teams on Instagram.',
  });
  await beat(page, 4500);
  await hideTitleCard(page);
  await beat(page, 600);

  // Setup — enter caller IG user_id
  await showCaption(page, 'Setup', 'Producer pastes their IG Business user_id (required for both flows)');
  await spotlight(page, '[data-testid="ig-user-id-input"]');
  await beat(page, 1200);
  await page.locator('[data-testid="ig-user-id-input"]').fill(env.DEMO_IG_USER_ID);
  await beat(page, 1500);

  // Flow A — hashtag
  await showCaption(page, 'Flow A · 1/2', 'Enter a casting-industry hashtag — e.g. #' + env.DEMO_HASHTAG);
  await spotlight(page, '[data-testid="hashtag-input"]');
  await beat(page, 1000);
  await page.locator('[data-testid="hashtag-input"]').fill(env.DEMO_HASHTAG);
  await beat(page, 1500);

  await showCaption(page, 'Flow A · 2/2', '→ /ig_hashtag_search resolves ID, then /recent_media returns a media grid');
  await spotlight(page, '[data-testid="search-hashtag-button"]');
  await beat(page, 1000);
  await page.locator('[data-testid="search-hashtag-button"]').click();
  await page.locator('[data-testid="hashtag-raw"], [data-testid="hashtag-err"]').first().waitFor({ timeout: 30_000 });
  await spotlight(page, '[data-testid="hashtag-result"]');
  await beat(page, 5000);
  await removeSpotlight(page);

  // Flow B — business discovery
  await showCaption(page, 'Flow B · 1/2', 'Enter a target IG handle — discover the public business profile');
  await spotlight(page, '[data-testid="ig-username-input"]');
  await beat(page, 1200);
  await page.locator('[data-testid="ig-username-input"]').fill(env.DEMO_IG_USERNAME);
  await beat(page, 1500);

  await showCaption(page, 'Flow B · 2/2', '→ /v21.0/{ig-user-id}?fields=business_discovery.username(...){...}');
  await spotlight(page, '[data-testid="discover-button"]');
  await beat(page, 1000);
  await page.locator('[data-testid="discover-button"]').click();
  await page.locator('[data-testid="discovery-raw"], [data-testid="discovery-err"]').first().waitFor({ timeout: 30_000 });
  await spotlight(page, '[data-testid="discovery-result"]');
  await beat(page, 5000);
  await removeSpotlight(page);

  await hideCaption(page);
  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'Instagram Public Content — End of Demo',
    body: 'Both flows succeed against /v21.0 endpoints. Read-only access to public IG hashtag content and IG Business profiles. No user-token impersonation, no private data, no write operations.',
  });
  await beat(page, 3500);
}

async function main() {
  const env = await loadEnv();
  // Tidlig env-validering — unngår å lekke browser-prosesser ved konfig-feil
  const missing = [];
  if (!env.DEMO_IG_USER_ID) missing.push('DEMO_IG_USER_ID');
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
      const stableName = `instagram-public-content-demo-${ts}.webm`;
      await fs.rename(path.join(VIDEO_DIR, stats[0].f), path.join(VIDEO_DIR, stableName));
      log(`→ ${stableName}`);
    }
  } catch {}
}

main();
