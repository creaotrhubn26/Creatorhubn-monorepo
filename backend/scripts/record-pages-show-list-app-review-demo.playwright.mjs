#!/usr/bin/env node
/**
 * Meta App Review screencast: pages_show_list.
 *
 * Records one video showing the account-picker flow on
 * /admin/pages-show-list-app-review-demo:
 *   Step 1: Connect via Facebook Login
 *   Step 2: Enter the user access token (+ demo user id)
 *   Step 3: List the Pages the user manages and pick one to connect
 *
 * Output: recordings/pages-show-list-demo-<ts>.webm
 *
 * Env (read from backend/.env.pages-show-list.demo.local if present):
 *   APP_BASE_URL                  default: https://creatorhub-backend-rtbl.onrender.com
 *   WHATSAPP_DEMO_BYPASS_TOKEN    bypass-token
 *   DEMO_ACCESS_TOKEN             token with pages_show_list
 *   DEMO_USER_ID                  user id (demo only — runs /{user-id}/accounts)
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const VIDEO_DIR = path.resolve(REPO_ROOT, 'recordings');
const ENV_FILE = path.resolve(REPO_ROOT, 'backend/.env.pages-show-list.demo.local');
const DEFAULT_APP_BASE = 'https://creatorhub-backend-rtbl.onrender.com';
const HEADLESS = process.env.HEADLESS === '1';
const VIEWPORT = { width: 1440, height: 900 };

function log(msg) { console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`); }
async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }

async function loadEnv() {
  const out = {
    APP_BASE_URL: process.env.APP_BASE_URL || DEFAULT_APP_BASE,
    WHATSAPP_DEMO_BYPASS_TOKEN: process.env.WHATSAPP_DEMO_BYPASS_TOKEN || '',
    DEMO_ACCESS_TOKEN: process.env.DEMO_ACCESS_TOKEN || '',
    DEMO_USER_ID: process.env.DEMO_USER_ID || '',
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
        border: 1.5px solid rgba(37, 99, 235, 0.6);
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
        color: #93c5fd;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      #ar-title {
        position: fixed; z-index: 2147483647; inset: 0;
        background: linear-gradient(135deg, rgba(30, 58, 138, 0.97), rgba(12, 74, 110, 0.97));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #f8fafc; text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        opacity: 0; transition: opacity 500ms ease;
      }
      #ar-title.show { opacity: 1; }
      #ar-title h1 { font-size: 48px; font-weight: 800; margin: 0 0 18px; letter-spacing: -0.01em; }
      #ar-title h2 { font-size: 22px; font-weight: 500; margin: 0 0 8px; color: #bfdbfe; }
      #ar-title p  { font-size: 18px; font-weight: 400; max-width: 780px; color: #dbeafe; margin: 24px 16px 0; line-height: 1.55; }
      .ar-spot {
        outline: 3px solid #2563eb !important;
        outline-offset: 6px;
        border-radius: 12px !important;
        box-shadow: 0 0 0 8px rgba(37, 99, 235, 0.32) !important;
        animation: arPulse 1.8s ease-in-out infinite;
      }
      @keyframes arPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(37,99,235,0.32) !important; }
        50%     { box-shadow: 0 0 0 16px rgba(37,99,235,0.12) !important; }
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
  const pageUrl = appendBypassToken(
    `${env.APP_BASE_URL}/admin/pages-show-list-app-review-demo`,
    env.WHATSAPP_DEMO_BYPASS_TOKEN,
  );
  log(`Navigating to ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await installStyles(page);

  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'pages_show_list — Account Picker',
    body: 'Demonstrating how The Role Room lists the Facebook Pages a user manages via GET /me/accounts, so a production team can pick which Page (and its connected Instagram Business + ad account) to link. The entry point for every Page/Instagram feature in the platform.',
  });
  await beat(page, 4500);
  await hideTitleCard(page);
  await beat(page, 600);

  // Step 1 — Connect
  await showCaption(page, 'Step 1', 'Production team connects its Meta account via Facebook Login (grants pages_show_list)');
  await spotlight(page, '[data-testid="connect-button"]');
  await beat(page, 1500);
  await page.locator('[data-testid="connect-button"]').click();
  await beat(page, 1500);
  await removeSpotlight(page);

  // Step 2 — credentials
  await showCaption(page, 'Step 2', 'User access token granted with pages_show_list');
  await spotlight(page, '[data-testid="access-token-input"]');
  await beat(page, 1000);
  await page.locator('[data-testid="access-token-input"]').fill(env.DEMO_ACCESS_TOKEN);
  await beat(page, 900);
  if (env.DEMO_USER_ID) {
    await page.locator('[data-testid="user-id-input"]').fill(env.DEMO_USER_ID);
    await beat(page, 700);
  }
  await removeSpotlight(page);

  // Step 3 — list pages + pick
  await showCaption(page, 'Step 3 · 1/2', '→ GET /v21.0/me/accounts?fields=id,name,category,picture');
  await spotlight(page, '[data-testid="load-pages-button"]');
  await beat(page, 1200);
  await page.locator('[data-testid="load-pages-button"]').click();
  await page.locator('[data-testid="page-card-0"], [data-testid="pages-err"]').first().waitFor({ timeout: 30_000 });
  await beat(page, 1500);

  await showCaption(page, 'Step 3 · 2/2', 'The user picks which Page to connect — only that Page is linked');
  await spotlight(page, '[data-testid="pages-result"]');
  await beat(page, 2000);
  // click a couple of Page cards to show selection
  const cards = page.locator('.page-card');
  const count = await cards.count();
  if (count > 1) {
    await cards.nth(1).click();
    await beat(page, 1400);
    await cards.nth(1 % count).click();
    await beat(page, 1400);
  }
  await beat(page, 2500);
  await removeSpotlight(page);

  await hideCaption(page);
  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'pages_show_list — End of Demo',
    body: 'pages_show_list enumerates the Pages a user manages for the account-picker. The user explicitly selects one Page; The Role Room only operates on the selected Page. No posts, messages, or private data are read here.',
  });
  await beat(page, 3500);
}

async function main() {
  const env = await loadEnv();
  const missing = [];
  if (!env.DEMO_ACCESS_TOKEN) missing.push('DEMO_ACCESS_TOKEN');
  if (missing.length) {
    console.error(`Error: required env missing: ${missing.join(', ')}`);
    console.error(`Set them via process.env or backend/.env.pages-show-list.demo.local`);
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
      const stableName = `pages-show-list-demo-${ts}.webm`;
      await fs.rename(path.join(VIDEO_DIR, stats[0].f), path.join(VIDEO_DIR, stableName));
      log(`→ ${stableName}`);
    }
  } catch {}
}

main();
