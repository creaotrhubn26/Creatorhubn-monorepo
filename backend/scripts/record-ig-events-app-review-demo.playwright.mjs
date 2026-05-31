#!/usr/bin/env node
/**
 * Meta App Review screencast: instagram_manage_events.
 *
 * Records one video showing the /admin/instagram-manage-events-app-review-demo
 * page being driven end-to-end:
 *   1. Setup — IG user_id + access token
 *   2. List existing events
 *   3. Create a new casting event (name + start + place + description)
 *   4. List again to confirm; optional delete demo
 *
 * Output: recordings/instagram-manage-events-demo-<ts>.webm
 *
 * Env (read from backend/.env.ig-events.demo.local if present):
 *   APP_BASE_URL                 default: https://creatorhub-backend-rtbl.onrender.com
 *   WHATSAPP_DEMO_BYPASS_TOKEN   bypass-token
 *   DEMO_IG_USER_ID              IG Business user_id
 *   DEMO_IG_TOKEN                Token with instagram_manage_events
 *   DEMO_EVENT_NAME              default: "Open Casting Call — Nordlys Lead"
 *   DEMO_EVENT_PLACE             default: "Filmens Hus, Oslo"
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(process.cwd());
const VIDEO_DIR = path.resolve(REPO_ROOT, 'recordings');
const ENV_FILE = path.resolve(REPO_ROOT, 'backend/.env.ig-events.demo.local');
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
    DEMO_IG_TOKEN: process.env.DEMO_IG_TOKEN || '',
    DEMO_EVENT_NAME: process.env.DEMO_EVENT_NAME || 'Open Casting Call — Nordlys Lead',
    DEMO_EVENT_PLACE: process.env.DEMO_EVENT_PLACE || 'Filmens Hus, Oslo',
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
        border: 1.5px solid rgba(245, 158, 11, 0.6);
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
        color: #fbbf24;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      #ar-title {
        position: fixed; z-index: 2147483647; inset: 0;
        background: linear-gradient(135deg, rgba(120, 53, 15, 0.97), rgba(131, 24, 67, 0.97));
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
        outline: 3px solid #f59e0b !important;
        outline-offset: 6px;
        border-radius: 12px !important;
        box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.32) !important;
        animation: arPulse 1.8s ease-in-out infinite;
      }
      @keyframes arPulse {
        0%,100% { box-shadow: 0 0 0 8px rgba(245,158,11,0.32) !important; }
        50%     { box-shadow: 0 0 0 16px rgba(245,158,11,0.12) !important; }
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
  if (!env.DEMO_IG_USER_ID) throw new Error('DEMO_IG_USER_ID required');
  if (!env.DEMO_IG_TOKEN) throw new Error('DEMO_IG_TOKEN required');

  const pageUrl = appendBypassToken(
    `${env.APP_BASE_URL}/admin/instagram-manage-events-app-review-demo`,
    env.WHATSAPP_DEMO_BYPASS_TOKEN,
  );
  log(`Navigating to ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await installStyles(page);

  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'instagram_manage_events — Casting Events on IG',
    body: 'Demonstrating list + create + delete against /v21.0/{ig-user-id}/events. Casting calls and audition days are published as IG events so a production team\\'s followers can RSVP or mark "interested" directly in Instagram.',
  });
  await beat(page, 4500);
  await hideTitleCard(page);
  await beat(page, 600);

  await showCaption(page, 'Setup', 'Producer enters IG Business user_id + Page-scoped token (with instagram_manage_events)');
  await spotlight(page, '[data-testid="ig-user-id-input"]');
  await beat(page, 1100);
  await page.locator('[data-testid="ig-user-id-input"]').fill(env.DEMO_IG_USER_ID);
  await beat(page, 400);
  await spotlight(page, '[data-testid="ig-token-input"]');
  await page.locator('[data-testid="ig-token-input"]').fill(env.DEMO_IG_TOKEN);
  await beat(page, 1500);

  await showCaption(page, 'Step 1', 'GET /v21.0/{ig-user-id}/events — list current events');
  await spotlight(page, '[data-testid="list-events-button"]');
  await beat(page, 1000);
  await page.locator('[data-testid="list-events-button"]').click();
  await page.locator('[data-testid="event-card"], [data-testid="events-err"], [data-testid="events-raw"]').first().waitFor({ timeout: 25_000 }).catch(() => {});
  await spotlight(page, '[data-testid="events-result"]');
  await beat(page, 4000);

  await showCaption(page, 'Step 2', 'Fill in casting-event details — name, start time, place, description');
  // Fill create-form
  const now = new Date();
  const startTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7d
  const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000);  // +4h
  const toLocal = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  await spotlight(page, '[data-testid="event-name-input"]');
  await beat(page, 800);
  await page.locator('[data-testid="event-name-input"]').fill(env.DEMO_EVENT_NAME);
  await page.locator('[data-testid="event-start-input"]').fill(toLocal(startTime));
  await page.locator('[data-testid="event-end-input"]').fill(toLocal(endTime));
  await page.locator('[data-testid="event-place-input"]').fill(env.DEMO_EVENT_PLACE);
  await page.locator('[data-testid="event-desc-input"]').fill('Bring 1 monologue + headshot. Casting director on site. Walk-ins welcome between 14:00-18:00.');
  await beat(page, 2200);

  await showCaption(page, 'Step 3', 'POST /v21.0/{ig-user-id}/events — create the event');
  await spotlight(page, '[data-testid="create-event-button"]');
  await beat(page, 1000);
  await page.locator('[data-testid="create-event-button"]').click();
  await page.locator('[data-testid="create-ok"], [data-testid="create-err"]').first().waitFor({ timeout: 25_000 }).catch(() => {});
  await spotlight(page, '[data-testid="create-result"]');
  await beat(page, 4500);
  await removeSpotlight(page);

  await hideCaption(page);
  await showTitleCard(page, {
    subtitle: 'The Role Room · Meta App Review',
    title: 'instagram_manage_events — End of Demo',
    body: 'Full CRUD against /v21.0/{ig-user-id}/events. Page admin grants instagram_manage_events explicitly. Followers see the casting event natively in Instagram and can RSVP — no separate signup landing page required.',
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
      const stableName = `instagram-manage-events-demo-${ts}.webm`;
      await fs.rename(path.join(VIDEO_DIR, stats[0].f), path.join(VIDEO_DIR, stableName));
      log(`→ ${stableName}`);
    }
  } catch {}
}

main();
