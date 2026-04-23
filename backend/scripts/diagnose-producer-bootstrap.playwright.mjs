#!/usr/bin/env node
/**
 * Fast-path diagnostic: hits /api/role-room/agent/producer-bootstrap via
 * the saved browser session and dumps the full response structure so we
 * can see WHY Holy Crust is returning 0 competitors.
 *
 * Requires .role-room-demo-state.json (produced by the recording script
 * on first run).
 */

import { chromium } from 'playwright';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'https://theroleroom.com';
const STATE_PATH = path.resolve(process.cwd(), '.role-room-demo-state.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH, locale: 'nb-NO' });
  const page = await context.newPage();

  try {
    // Navigate so the origin is set + any app-load side effects run.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    console.log('Calling /api/role-room/agent/producer-bootstrap …');
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/role-room/agent/producer-bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: 'diagnostic',
          projectName: 'Holy Crust',
          websiteUrl: 'https://holycrust.no',
          organizationNumber: '',
          companyName: 'Holy Crust',
          extraContext: '',
        }),
      });
      const bodyText = await response.text();
      let parsed = null;
      try { parsed = JSON.parse(bodyText); } catch { /* keep text */ }
      return { status: response.status, parsed, raw: parsed ? null : bodyText.slice(0, 2000) };
    });

    console.log(`status: ${result.status}`);
    if (result.parsed) {
      const body = result.parsed;
      console.log(`top-level keys: ${Object.keys(body).join(', ')}`);
      console.log(`brregCompany: ${JSON.stringify(body.brregCompany, null, 2)}`);
      console.log(`businessSignals: ${JSON.stringify(body.businessSignals, null, 2)}`);
      const ca = body.competitorAnalysis ?? {};
      console.log(`competitorAnalysis keys: ${Object.keys(ca).join(', ')}`);
      console.log(`  competitors.length: ${(ca.competitors ?? []).length}`);
      console.log(`  summary: ${JSON.stringify(ca.summary, null, 2)}`);
      console.log(`  limitation: ${JSON.stringify(ca.limitation, null, 2)}`);
      console.log(`  limitationMessage: ${ca.limitationMessage}`);
      console.log(`websiteInsights: siteName=${body.websiteInsights?.siteName}, finalUrl=${body.websiteInsights?.finalUrl}`);
    } else {
      console.log(`raw body: ${result.raw}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
})();
