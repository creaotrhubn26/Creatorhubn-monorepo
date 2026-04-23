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
    // Hydrate the SPA so auth context is established before API calls.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    // Wait for a signal that auth hydrated — the agent button is a
    // reasonable indicator but requires a specific panel to be open.
    // Instead, look for any auth-gated element or just wait.
    await page.waitForTimeout(2000);

    const results = await page.evaluate(async () => {
      async function call(pathname, body) {
        const response = await fetch(pathname, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const text = await response.text();
        return { status: response.status, body: text.slice(0, 200) };
      }
      const bootstrap = await call('/api/role-room/agent/producer-bootstrap', {
        projectId: 'diag', projectName: 'Test', websiteUrl: 'https://example.com',
      });
      const inspect = await call('/api/role-room/agent/meta-page-inspect', {
        pageIdOrUrl: 'creatorhubn',
      });
      return { bootstrap, inspect };
    });
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})();
