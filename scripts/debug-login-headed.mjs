#!/usr/bin/env node
/**
 * debug-login-headed.mjs
 *
 * Åpner en synlig browser, lar deg logge inn med Google manuelt.
 * Playwright fanger ALT som skjer fra start til slutt, og dumper full
 * rapport som identifiserer bouncen.
 *
 * Kjør:
 *   $ node scripts/debug-login-headed.mjs
 *
 * Etter at browser åpner:
 *   1. Klikk "Fortsett med Google"
 *   2. Logg inn med din Google-konto
 *   3. Vent på bouncen (eller vellykket dashboard-load)
 *   4. Trykk Enter i terminalen for å avslutte og se rapport
 */

import { chromium } from 'playwright';
import readline from 'readline';

const FRONTEND = 'https://creatorhubn.com';

async function waitForEnter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question('\n>>> Trykk Enter når flyten er ferdig (bounce eller dashboard) <<<\n', () => { rl.close(); resolve(); }));
}

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Login-bounce-debug (HEADED — du logger inn manuelt)');
  console.log('  Target:', FRONTEND);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const logs = [];
  const navs = [];
  const nets = [];

  page.on('console', (msg) => {
    logs.push({ type: msg.type(), text: msg.text(), ts: Date.now() });
  });
  page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message, ts: Date.now() }));
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) navs.push({ url: f.url(), ts: Date.now() });
  });
  page.on('response', async (r) => {
    const url = r.url();
    if (
      url.includes('/api/') ||
      url.includes('/login') ||
      url.includes('/dashboard') ||
      url.includes('google.com')
    ) {
      let body = null;
      if (r.status() < 300 && url.includes('session-result')) {
        try { body = await r.json(); } catch { /* ignore */ }
      }
      nets.push({ method: r.request().method(), url, status: r.status(), body });
    }
  });

  await page.goto(`${FRONTEND}/login`, { waitUntil: 'load', timeout: 30_000 });

  console.log('\n>>> Browser er åpen. Logg inn med Google nå. <<<\n');
  await waitForEnter();

  const final = await page.evaluate(() => ({
    url: window.location.href,
    pathname: window.location.pathname,
    hasToken: !!localStorage.getItem('creatorhub_auth_token'),
    tokenPrefix: localStorage.getItem('creatorhub_auth_token')?.slice(0, 16),
    user: (() => { try { return JSON.parse(localStorage.getItem('creatorhub_auth_user') || 'null'); } catch { return null; } })(),
    storageErrors: sessionStorage.getItem('creatorhub_google_login_error'),
  }));

  console.log('\n━━━ FINAL STATE ━━━');
  console.log(JSON.stringify({
    url: final.url,
    pathname: final.pathname,
    hasToken: final.hasToken,
    tokenPrefix: final.tokenPrefix,
    userId: final.user?.id,
    userEmail: final.user?.email,
    storageErrors: final.storageErrors,
  }, null, 2));

  const t0 = navs[0]?.ts ?? Date.now();
  console.log('\n━━━ NAVIGASJONER (kronologisk, ms relativ) ━━━');
  navs.forEach((n, i) => {
    console.log(`  [${i}] +${n.ts - t0}ms  ${n.url.replace(FRONTEND, '').slice(0, 120)}`);
  });

  console.log('\n━━━ RELEVANTE NETWORK-CALLS ━━━');
  nets.filter(n =>
    n.url.includes('oauth') ||
    n.url.includes('session-result') ||
    n.url.includes('/auth/') ||
    n.url.includes('public-session') ||
    n.url.includes('/dashboard') ||
    n.status === 401 ||
    n.status === 404
  ).forEach(n => {
    const u = n.url.replace(FRONTEND, '').replace('https://creatorhub-backend-rtbl.onrender.com', '[backend]');
    console.log(`  ${n.status}  ${n.method}  ${u.slice(0, 100)}`);
    if (n.body) console.log(`         body: ${JSON.stringify(n.body).slice(0, 200)}`);
  });

  console.log('\n━━━ CONSOLE — DEBUG-meldinger + errors ━━━');
  logs.filter(l =>
    l.text.includes('DEBUG_v5') ||
    l.text.includes('apiRequest') ||
    l.text.includes('Google') ||
    l.type === 'error' ||
    l.type === 'pageerror'
  ).forEach(l => {
    console.log(`  [${l.type}] +${l.ts - t0}ms  ${l.text.slice(0, 250)}`);
  });

  const bounced = final.pathname.startsWith('/login') || final.pathname === '/';
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  RESULTAT: ${bounced ? '🚨 BOUNCET / aldri nådd dashboard' : '✅ Holdt på dashboard'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await browser.close();
}

run().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });
