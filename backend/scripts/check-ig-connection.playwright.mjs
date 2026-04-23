#!/usr/bin/env node
import { chromium } from 'playwright';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'https://theroleroom.com';
const STATE_PATH = path.resolve(process.cwd(), '.role-room-demo-state.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH, locale: 'nb-NO' });
  const page = await context.newPage();
  try {
    // Give the SPA a chance to hydrate auth state
    await page.goto(`${APP_URL}/role-room`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/role-room/instagram/connections', { credentials: 'include' });
      const text = await r.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {}
      return { status: r.status, parsed, text: parsed ? null : text.slice(0, 500) };
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
})();
