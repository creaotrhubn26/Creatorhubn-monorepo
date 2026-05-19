#!/usr/bin/env node
/**
 * debug-login-bounce.mjs — Slice 9X.60
 *
 * Playwright-script som reproduserer bouncen automatisk og rapporterer:
 *   1. Hva som skjer når vi simulerer å være innlogget (token i localStorage)
 *   2. Alle Console-meldinger (warn, error, log, info)
 *   3. Alle Network-requests (med status + URL)
 *   4. Alle navigasjoner (URL-endringer)
 *   5. Alle localStorage-endringer (set/remove)
 *   6. Final URL + auth-state etter 5 sek
 *
 * Kjør:
 *   $ node scripts/debug-login-bounce.mjs
 *
 * Hvis Playwright krever browser-installasjon:
 *   $ npx playwright install chromium
 */

import { chromium } from 'playwright';

const FRONTEND = 'https://creatorhubn.com';

const log = (label, data) => {
  console.log(`\n━━━ ${label} ━━━`);
  if (typeof data === 'string') console.log(data);
  else console.log(JSON.stringify(data, null, 2));
};

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Login-bounce-debug via Playwright');
  console.log('  Target:', FRONTEND);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    bypassCSP: true,
    storageState: undefined, // starter blank (som incognito)
  });
  const page = await ctx.newPage();

  const consoleLogs = [];
  const networkRequests = [];
  const navigations = [];
  const localStorageOps = [];

  // ── Hook into Console ──
  page.on('console', (msg) => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      url: page.url(),
    });
  });
  page.on('pageerror', (err) => {
    consoleLogs.push({ type: 'pageerror', text: err.message, url: page.url() });
  });

  // ── Hook into Network ──
  page.on('response', (resp) => {
    const url = resp.url();
    if (url.includes('/api/') || url.includes('/login') || url.includes('/dashboard') || url.includes('/auth')) {
      networkRequests.push({
        method: resp.request().method(),
        url: url.replace(FRONTEND, ''),
        status: resp.status(),
      });
    }
  });

  // ── Hook into Navigations ──
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      navigations.push({ ts: Date.now(), url: frame.url() });
    }
  });

  // ── STEP 1: Naviger til /login (kontroll: starttilstand) ──
  console.log('\n[1] Naviger til /login…');
  await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle', timeout: 30_000 });
  const initialStorage = await page.evaluate(() => ({
    token: !!localStorage.getItem('creatorhub_auth_token'),
    user: !!localStorage.getItem('creatorhub_auth_user'),
    url: window.location.href,
  }));
  log('STEP 1 — Initial state', initialStorage);

  // ── STEP 2: Simuler post-login state ved å injisere token ──
  // (Vi kan ikke logge inn med Google fra automation, så vi simulerer
  // det successive resultatet: token + user i localStorage)
  console.log('\n[2] Injiserer fake token i localStorage og navigerer til /dashboard…');
  await page.evaluate(() => {
    const fakeUser = {
      id: 'test-user-id-12345',
      email: 'test@example.com',
      name: 'Test User',
      displayName: 'Test User',
      role: 'user',
      profession: 'photographer',
      isAdmin: false,
      verified_email: true,
      loginAt: new Date().toISOString(),
    };
    localStorage.setItem('creatorhub_auth_token', 'fake-token-for-testing');
    localStorage.setItem('creatorhub_auth_user', JSON.stringify(fakeUser));
    window.dispatchEvent(new Event('auth-changed'));
  });

  // Naviger til /dashboard
  await page.goto(`${FRONTEND}/dashboard`, { waitUntil: 'load', timeout: 30_000 });

  // Vent 5 sek for å se hva som skjer
  await page.waitForTimeout(5000);

  const finalState = await page.evaluate(() => ({
    url: window.location.href,
    pathname: window.location.pathname,
    hasToken: !!localStorage.getItem('creatorhub_auth_token'),
    hasUser: !!localStorage.getItem('creatorhub_auth_user'),
    bodyText: document.body.innerText.slice(0, 300),
  }));
  log('STEP 2 — Final state etter 5s på /dashboard', finalState);

  // ── Resultater ──
  log('NAVIGATIONS (kronologisk)', navigations.map((n, i) => ({
    n: i,
    url: n.url.replace(FRONTEND, ''),
    relativeMs: i === 0 ? 0 : n.ts - navigations[0].ts,
  })));

  log('NETWORK REQUESTS (sortert kronologisk)', networkRequests);

  // Filtrer Console på det relevante
  const relevant = consoleLogs.filter((l) =>
    l.text.includes('DEBUG_v5') ||
    l.text.includes('AUTH_DEBUG') ||
    l.text.includes('apiRequest') ||
    l.text.includes('clearStoredAuth') ||
    l.text.includes('clearClientAuthState') ||
    l.text.includes('clearCreatorHubAuthSession') ||
    l.type === 'error' ||
    l.type === 'pageerror'
  );
  log('CONSOLE — relevante meldinger (filtrert)', relevant);

  // Bounce-deteksjon
  const bounced = finalState.pathname.startsWith('/login') || finalState.pathname === '/';
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  RESULTAT: ${bounced ? '🚨 BOUNCET' : '✅ HOLDT på dashboard'}`);
  console.log(`  Final URL: ${finalState.url}`);
  console.log(`  Token fortsatt i localStorage: ${finalState.hasToken}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await browser.close();
  process.exit(bounced ? 1 : 0);
}

run().catch((err) => {
  console.error('Script error:', err);
  process.exit(2);
});
