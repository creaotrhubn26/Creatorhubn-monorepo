import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
const SHOTS = '/tmp/reknaren-framover-shots';
mkdirSync(SHOTS, { recursive: true });
const TOKEN = readFileSync('/tmp/reknaren-demo.tok', 'utf8').trim();
const ORG_ID = readFileSync('/tmp/reknaren-demo.org', 'utf8').trim();
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 1500 } });
await page.addInitScript(([t, o]) => {
  sessionStorage.setItem('reknaren.token', t);
  sessionStorage.setItem('reknaren.orgId', o);
  sessionStorage.setItem('reknaren.email', 'framover@reknaren.no');
}, [TOKEN, ORG_ID]);
try {
  await page.goto('http://localhost:4315');
  await page.waitForSelector('nav button:has-text("Framover")', { timeout: 10000 });
  await page.click('nav button:has-text("Framover")');
  await page.waitForSelector('h2:has-text("Likviditet neste 90 dager")', { timeout: 8000 });
  await page.waitForSelector('.liq-chart', { timeout: 8000 });
  await page.waitForSelector('h2:has-text("Faste kostnader")', { timeout: 8000 });
  await page.screenshot({ path: `${SHOTS}/framover.png`, fullPage: true });
  console.log('FRAMOVER-DEMO OK');
  await browser.close();
} catch (err) {
  await page.screenshot({ path: `${SHOTS}/FAILURE.png`, fullPage: true });
  console.error('FAIL:', err.message);
  await browser.close();
  process.exit(1);
}
