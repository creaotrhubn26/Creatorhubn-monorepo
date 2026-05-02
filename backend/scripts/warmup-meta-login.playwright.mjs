#!/usr/bin/env node
/**
 * Engangs warmup: åpner Playwright-Chrome, lar deg logge inn på Meta
 * Business Manager med daniel@creatorhubn.com, lagrer cookies til
 * .role-room-admin-state.json — slik at Video 2 i recording-scriptet
 * kan vise template-listen direkte uten login-prompt.
 *
 * Bruk:
 *   node backend/scripts/warmup-meta-login.playwright.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const REPO_ROOT = path.resolve(process.cwd());
const STATE_FILE = path.resolve(REPO_ROOT, '.role-room-admin-state.json');

async function loadIfExists(p) {
  try {
    await fs.access(p);
    return p;
  } catch {
    return undefined;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    storageState: await loadIfExists(STATE_FILE),
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  console.log('Opening Meta Business Manager — log in with daniel@creatorhubn.com.');
  console.log('When you see the WhatsApp template list, return here and press Enter.\n');
  await page.goto('https://business.facebook.com/wa/manage/message-templates/', {
    waitUntil: 'domcontentloaded',
  });

  const rl = readline.createInterface({ input: stdin, output: stdout });
  await rl.question('>> Trykk Enter når du ser template-listen i Chrome-vinduet... ');
  rl.close();

  await context.storageState({ path: STATE_FILE });
  console.log(`✓ Cookies lagret til ${STATE_FILE}`);
  await browser.close();
  console.log('Warmup done. Du kan nå kjøre recording-scriptet — Video 2 skal være auto-innlogget.');
})().catch((err) => {
  console.error('Warmup failed:', err);
  process.exit(1);
});
