#!/usr/bin/env node
/**
 * debug-oauth-callback.mjs
 *
 * Simulerer at brukeren kommer tilbake fra Google med success-flagg.
 * Vi har ingen ekte transferId, så session-result vil 404.
 * Målet er å se HVA frontend gjør i den feilflyten, og om noen
 * sequence av events fører til at brukeren havner på /login.
 */

import { chromium } from 'playwright';

const FRONTEND = 'https://creatorhubn.com';

async function run() {
  console.log('━━━ OAuth-callback bounce-debug ━━━\n');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const logs = [];
  const navs = [];
  const nets = [];

  page.on('console', (msg) => {
    if (msg.type() === 'log' || msg.type() === 'warning' || msg.type() === 'error') {
      logs.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message }));
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) navs.push({ url: f.url(), ts: Date.now() });
  });
  page.on('response', (r) => {
    const url = r.url();
    if (url.includes('/api/') || url.includes('/login') || url.includes('/dashboard')) {
      nets.push({ url: url.replace(FRONTEND, ''), status: r.status() });
    }
  });

  // Naviger med fake success-params som Google-callback ville sende
  const fakeTransferId = 'test-transfer-' + Date.now();
  const callbackUrl = `${FRONTEND}/login?chGoogleStatus=success&chGoogleMode=login&chGoogleTransfer=${fakeTransferId}`;
  console.log('1. Navigerer med fake OAuth success-params:');
  console.log(`   ${callbackUrl}\n`);

  await page.goto(callbackUrl, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForTimeout(4000);

  const state = await page.evaluate(() => ({
    url: window.location.href,
    pathname: window.location.pathname,
    hasToken: !!localStorage.getItem('creatorhub_auth_token'),
    sessionStorageError: sessionStorage.getItem('creatorhub_google_login_error'),
    bodyText: document.body.innerText.slice(0, 200),
  }));

  console.log('2. State etter 4 sek:');
  console.log(JSON.stringify(state, null, 2));
  console.log('');

  console.log('3. Navigasjoner:');
  navs.forEach((n, i) => console.log(`   [${i}] ${n.url.replace(FRONTEND, '')}`));
  console.log('');

  console.log('4. Network-calls (relevante):');
  nets.filter(n => n.url.includes('oauth') || n.url.includes('auth') || n.status === 401 || n.status === 404).forEach(n => {
    console.log(`   ${n.status}  ${n.url}`);
  });
  console.log('');

  console.log('5. Console-meldinger (DEBUG_v5 + errors):');
  logs.filter(l => l.text.includes('DEBUG_v5') || l.text.includes('Google') || l.type === 'error' || l.type === 'pageerror' || l.text.includes('apiRequest')).forEach(l => {
    console.log(`   [${l.type}] ${l.text.slice(0, 200)}`);
  });

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
