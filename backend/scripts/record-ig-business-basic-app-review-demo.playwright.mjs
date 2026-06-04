#!/usr/bin/env node
/**
 * Meta App Review screencast: instagram_business_basic.
 *
 * Records one video showing the connect + profile-read flow on
 * /admin/instagram-business-basic-app-review-demo:
 *   Step 1: Connect the Instagram professional account (Facebook Login)
 *   Step 2: Enter the connected IG Business user_id + access token
 *   Step 3: Read + display the connected account's profile
 *           (username, profile picture, account_type, followers, posts)
 *
 * Output: recordings/instagram-business-basic-demo-<ts>.webm
 *
 * Env (read from backend/.env.ig-business-basic.demo.local if present):
 *   APP_BASE_URL                  default: https://creatorhub-backend-rtbl.onrender.com
 *   WHATSAPP_DEMO_BYPASS_TOKEN    bypass-token
 *   DEMO_IG_USER_ID               connected IG Business user_id
 *   DEMO_IG_PAGE_ACCESS_TOKEN     access token with instagram_business_basic
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
const ENV_FILE = path.resolve(REPO_ROOT, 'backend/.env.ig-business-basic.demo.local');
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
        border: 1.5px solid rgba(139, 92, 246, 0.6);
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
        background: linear-gradient(135deg, rgba(76, 29, 149, 0.97), rgba(131, 24, 67, 0.97));
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
        outline: 3px solid #8b5cf6 !important;
        outline-offset: 6px;
        border-radius: 12px !important;
        box-shadow: 0 0 0 8px rgba(139, 92, 246, 0.32) !important;
        animation: arPulse 1.8s ease-in-out infinite;
      }
      @keyframes arPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(139,92,246,0.32) !important; }
        50%     { box-shadow: 0 0 0 16px rgba(139,92,246,0.12) !important; }
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
    `${env.APP_BASE_URL}/admin/instagram-business-basic-app-review-demo`,
    env.WHATSAPP_DEMO_BYPASS_TOKEN,
  );
  log(`Navigating to ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await installStyles(page);

  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'Instagram Business Basic — Connected Account Profile',
    body: 'Demonstrating how a production team connects its Instagram professional account, and how The Role Room reads + displays that account’s basic profile (username, profile picture) via GET /v21.0/{ig-user-id}?fields=username,account_type,profile_picture_url,followers_count,media_count — so the user can confirm the correct account is linked.',
  });
  await beat(page, 4500);
  await hideTitleCard(page);
  await beat(page, 600);

  // Step 1 — Connect
  await showCaption(page, 'Step 1', 'Production team connects its Instagram professional account via Facebook Login');
  await spotlight(page, '[data-testid="connect-button"]');
  await beat(page, 1500);
  await page.locator('[data-testid="connect-button"]').click();
  await beat(page, 1800);
  await removeSpotlight(page);

  // Step 2 — credentials of the connected account
  await showCaption(page, 'Step 2 · 1/2', 'The connected IG Business user_id is resolved from /me/accounts');
  await spotlight(page, '[data-testid="ig-user-id-input"]');
  await beat(page, 1200);
  await page.locator('[data-testid="ig-user-id-input"]').fill(env.DEMO_IG_USER_ID);
  await beat(page, 1200);

  await showCaption(page, 'Step 2 · 2/2', 'Access token granted with instagram_business_basic');
  await spotlight(page, '[data-testid="ig-token-input"]');
  await beat(page, 1000);
  await page.locator('[data-testid="ig-token-input"]').fill(env.DEMO_IG_PAGE_ACCESS_TOKEN);
  await beat(page, 1200);
  await removeSpotlight(page);

  // Step 3 — read + display profile
  await showCaption(page, 'Step 3 · 1/2', '→ GET /v21.0/{ig-user-id}?fields=username,account_type,profile_picture_url…');
  await spotlight(page, '[data-testid="read-profile-button"]');
  await beat(page, 1200);
  await page.locator('[data-testid="read-profile-button"]').click();
  await page.locator('[data-testid="profile-card"], [data-testid="profile-err"]').first().waitFor({ timeout: 30_000 });

  await showCaption(page, 'Step 3 · 2/2', 'The connected account’s username + profile picture are shown back to the user');
  await spotlight(page, '[data-testid="profile-result"]');
  await beat(page, 5500);
  await removeSpotlight(page);

  await hideCaption(page);
  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'Instagram Business Basic — End of Demo',
    body: 'The connected Instagram professional account’s basic profile is read read-only and displayed back so the user confirms the right account is linked. No private data, no write operations — only accounts whose Page admin granted instagram_business_basic.',
  });
  await beat(page, 3500);
}

async function main() {
  const env = await loadEnv();
  // Tidlig env-validering — unngår å lekke browser-prosesser ved konfig-feil
  const missing = [];
  if (!env.DEMO_IG_USER_ID) missing.push('DEMO_IG_USER_ID');
  if (!env.DEMO_IG_PAGE_ACCESS_TOKEN) missing.push('DEMO_IG_PAGE_ACCESS_TOKEN');
  if (missing.length) {
    console.error(`Error: required env missing: ${missing.join(', ')}`);
    console.error(`Set them via process.env or backend/.env.ig-business-basic.demo.local`);
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
      const stableName = `instagram-business-basic-demo-${ts}.webm`;
      await fs.rename(path.join(VIDEO_DIR, stats[0].f), path.join(VIDEO_DIR, stableName));
      log(`→ ${stableName}`);
    }
  } catch {}
}

main();
