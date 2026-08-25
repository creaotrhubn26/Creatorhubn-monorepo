import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
const SHOTS = '/tmp/reknaren-ask-shots';
mkdirSync(SHOTS, { recursive: true });
const TOKEN = readFileSync('/tmp/reknaren-demo.tok', 'utf8').trim();
const ORG_ID = readFileSync('/tmp/reknaren-demo.org', 'utf8').trim();
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 1050 } });
await page.addInitScript(([t, o]) => {
  sessionStorage.setItem('reknaren.token', t); sessionStorage.setItem('reknaren.orgId', o); sessionStorage.setItem('reknaren.email', 'ask@reknaren.no');
}, [TOKEN, ORG_ID]);
try {
  await page.goto('http://localhost:4315');
  await page.click('nav button:has-text("Spør virksomheten")');
  await page.waitForSelector('#ask-q', { timeout: 8000 });
  await page.fill('#ask-q', 'Hva bruker vi på programvare?');
  await page.press("#ask-q", "Enter");
  await page.waitForSelector('h3:has-text("Bevis")', { timeout: 8000 });
  await page.screenshot({ path: `${SHOTS}/spor.png`, fullPage: true });
  console.log('ASK-DEMO OK');
  await browser.close();
} catch (err) {
  await page.screenshot({ path: `${SHOTS}/FAILURE.png`, fullPage: true });
  console.error('FAIL:', err.message);
  await browser.close();
  process.exit(1);
}
