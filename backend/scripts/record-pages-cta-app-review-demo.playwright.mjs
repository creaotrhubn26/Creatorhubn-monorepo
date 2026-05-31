#!/usr/bin/env node
/**
 * Meta App Review screencast: pages_manage_cta.
 *
 * Records one video showing the /admin/pages-manage-cta-app-review-demo
 * page being driven end-to-end:
 *   1. Producer connects a Page (provides Page ID + Page-scoped token)
 *   2. Producer picks a CTA type and target URL
 *   3. Click "Set CTA" → backend POSTs /v21.0/{page-id} with cta_type+cta_link
 *   4. Click "Verify" → backend reads cta_type+cta_link back from the Page
 *
 * Output: recordings/pages-manage-cta-demo-<ts>.webm
 *
 * Usage:
 *   node backend/scripts/record-pages-cta-app-review-demo.playwright.mjs
 *
 * Env (read from backend/.env.pages-cta.demo.local if present):
 *   APP_BASE_URL                 default: https://creatorhub-backend-rtbl.onrender.com
 *   WHATSAPP_DEMO_BYPASS_TOKEN   same bypass-token as the WhatsApp/oEmbed demos
 *   DEMO_PAGE_ID                 Facebook Page ID
 *   DEMO_PAGE_ACCESS_TOKEN       Page-scoped token (from /me/accounts)
 *   DEMO_CTA_URL                 target URL for the CTA (e.g. /audition/lead)
 *   DEMO_CTA_TYPE                CTA type (default: BOOK_NOW)
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
const ENV_FILE = path.resolve(REPO_ROOT, 'backend/.env.pages-cta.demo.local');
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
    DEMO_PAGE_ID: process.env.DEMO_PAGE_ID || '',
    DEMO_PAGE_ACCESS_TOKEN: process.env.DEMO_PAGE_ACCESS_TOKEN || '',
    DEMO_CTA_URL: process.env.DEMO_CTA_URL || '',
    DEMO_CTA_TYPE: process.env.DEMO_CTA_TYPE || 'BOOK_NOW',
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

// ── Visual overlay helpers (samme stiler som oEmbed-scriptet) ─────────────

async function installStyles(page) {
  await page.addStyleTag({
    content: `
      #ar-caption {
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
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        opacity: 0; transition: opacity 420ms ease;
        pointer-events: none;
      }
      #ar-caption.show { opacity: 1; }
      #ar-caption .step {
        display: block;
        font: 800 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0.22em;
        color: #c4b5fd;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      #ar-title {
        position: fixed; z-index: 2147483647; inset: 0;
        background: radial-gradient(circle at 50% 45%, rgba(76, 29, 149, 0.95), rgba(2, 6, 23, 0.98));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #f8fafc; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0; transition: opacity 500ms ease;
      }
      #ar-title.show { opacity: 1; }
      #ar-title h1 { font-size: 48px; font-weight: 800; margin: 0 0 18px; letter-spacing: -0.01em; }
      #ar-title h2 { font-size: 22px; font-weight: 500; margin: 0 0 8px; color: #ddd6fe; }
      #ar-title p  { font-size: 18px; font-weight: 400; max-width: 780px; color: #ede9fe; margin: 24px 16px 0; line-height: 1.55; }
      .ar-spot {
        outline: 3px solid #a855f7 !important;
        outline-offset: 6px;
        border-radius: 12px !important;
        box-shadow: 0 0 0 8px rgba(168, 85, 247, 0.32) !important;
        animation: arPulse 1.8s ease-in-out infinite;
      }
      @keyframes arPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(168,85,247,0.32) !important; }
        50%     { box-shadow: 0 0 0 16px rgba(168,85,247,0.12) !important; }
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
  const pageUrl = appendBypassToken(
    `${env.APP_BASE_URL}/admin/pages-manage-cta-app-review-demo`,
    env.WHATSAPP_DEMO_BYPASS_TOKEN,
  );
  log(`Navigating to ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await installStyles(page);

  // Title
  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'pages_manage_cta — Set Role Agent CTA',
    body: 'Demonstrating end-to-end use of Graph API POST /v21.0/{page-id} with cta_type + cta_link, plus verification via GET /v21.0/{page-id}?fields=cta_type,cta_link. Used by Role Agent to align Facebook Page CTAs with active production milestones.',
  });
  await beat(page, 4500);
  await hideTitleCard(page);
  await beat(page, 600);

  // Step 1: enter Page credentials
  await showCaption(page, 'Step 1', 'Producer connects the Facebook Page (Page-scoped token + Page ID)');
  await spotlight(page, '[data-testid="page-id-input"]');
  await beat(page, 1200);
  await page.locator('[data-testid="page-id-input"]').fill(env.DEMO_PAGE_ID);
  await beat(page, 500);
  await spotlight(page, '[data-testid="page-token-input"]');
  await page.locator('[data-testid="page-token-input"]').fill(env.DEMO_PAGE_ACCESS_TOKEN);
  await beat(page, 1500);

  // Step 2: choose CTA type + URL
  await showCaption(page, 'Step 2', 'Role Agent picks the CTA type and target URL for the production');
  await spotlight(page, '[data-testid="cta-type-select"]');
  await beat(page, 1000);
  await page.locator('[data-testid="cta-type-select"]').selectOption(env.DEMO_CTA_TYPE);
  await beat(page, 700);
  await spotlight(page, '[data-testid="cta-url-input"]');
  await page.locator('[data-testid="cta-url-input"]').fill(env.DEMO_CTA_URL);
  await beat(page, 1500);

  // Step 3: trigger Set CTA — calls POST /v21.0/{page-id}
  await showCaption(page, 'Step 3', 'Backend calls POST /v21.0/{page-id} with cta_type + cta_link');
  await spotlight(page, '[data-testid="set-cta-button"]');
  await beat(page, 1200);
  await page.locator('[data-testid="set-cta-button"]').click();
  await page.locator('[data-testid="result-ok"], [data-testid="result-err"]').first().waitFor({ timeout: 20_000 });
  await spotlight(page, '[data-testid="result"]');
  await beat(page, 3500);

  // Step 4: verify by reading back
  await showCaption(page, 'Step 4', 'Verify: GET /v21.0/{page-id}?fields=cta_type,cta_link');
  await spotlight(page, '[data-testid="verify-cta-button"]');
  await beat(page, 1200);
  await page.locator('[data-testid="verify-cta-button"]').click();
  await page.locator('[data-testid="result-verify-ok"], [data-testid="result-err"]').first().waitFor({ timeout: 20_000 });
  await spotlight(page, '[data-testid="result"]');
  await beat(page, 3500);
  await removeSpotlight(page);

  // End card
  await hideCaption(page);
  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'pages_manage_cta — End of Demo',
    body: 'POST + GET succeeded against /v21.0/{page-id} using a Page-scoped token. Role Agent now aligns the Page CTA with active casting milestones. No user or message data is read or stored — only the public CTA fields are modified.',
  });
  await beat(page, 3500);
}

// ── Driver ────────────────────────────────────────────────────────────────

async function main() {
  const env = await loadEnv();
  // Tidlig env-validering — unngår å lekke browser-prosesser ved konfig-feil
  const missing = [];
  if (!env.DEMO_PAGE_ID) missing.push('DEMO_PAGE_ID');
  if (!env.DEMO_PAGE_ACCESS_TOKEN) missing.push('DEMO_PAGE_ACCESS_TOKEN');
  if (!env.DEMO_CTA_URL) missing.push('DEMO_CTA_URL');
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
      const stableName = `pages-manage-cta-demo-${ts}.webm`;
      await fs.rename(path.join(VIDEO_DIR, stats[0].f), path.join(VIDEO_DIR, stableName));
      log(`→ ${stableName}`);
    }
  } catch {}
}

main();
