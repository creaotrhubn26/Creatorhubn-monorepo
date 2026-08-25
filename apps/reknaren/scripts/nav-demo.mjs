import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
const SHOTS = '/tmp/reknaren-nav-shots';
mkdirSync(SHOTS, { recursive: true });
const TOKEN = readFileSync('/tmp/reknaren-demo.tok', 'utf8').trim();
const ORG_ID = readFileSync('/tmp/reknaren-demo.org', 'utf8').trim();
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
await page.addInitScript(([t, o]) => {
  sessionStorage.setItem('reknaren.token', t); sessionStorage.setItem('reknaren.orgId', o); sessionStorage.setItem('reknaren.email', 'cockpit@reknaren.no');
}, [TOKEN, ORG_ID]);
try {
  await page.goto('http://localhost:4315');
  // 1) Bank med innebygd Dokumentjakt
  await page.click('nav button:has-text("Bank og avstemming")');
  await page.waitForSelector('h2:has-text("Dokumentjakt")', { timeout: 8000 });
  await page.screenshot({ path: `${SHOTS}/bank-dokumentjakt.png`, fullPage: true });
  // 2) Salg og faktura → risiko-modal
  await page.click('nav button:has-text("Salg og faktura")');
  await page.waitForSelector('button:has-text("Sjekk kunde (risiko)")', { timeout: 8000 });
  await page.click('button:has-text("Sjekk kunde (risiko)")');
  await page.waitForSelector('.modal', { timeout: 6000 });
  await page.fill('#cr-org', '923609016');
  await page.click('.modal button:has-text("Sjekk")');
  await page.waitForSelector('.modal .health-list', { timeout: 8000 });
  await page.screenshot({ path: `${SHOTS}/risiko-modal.png`, fullPage: true });
  console.log('NAV-DEMO OK');
  await browser.close();
} catch (err) {
  await page.screenshot({ path: `${SHOTS}/FAILURE.png`, fullPage: true });
  console.error('FAIL:', err.message);
  await browser.close();
  process.exit(1);
}
