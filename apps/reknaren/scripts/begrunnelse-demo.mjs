import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
const SHOTS = '/tmp/reknaren-begrunnelse-shots';
mkdirSync(SHOTS, { recursive: true });
const TOKEN = readFileSync('/tmp/reknaren-demo.tok', 'utf8').trim();
const ORG_ID = readFileSync('/tmp/reknaren-demo.org', 'utf8').trim();
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
await page.addInitScript(([t, o]) => {
  sessionStorage.setItem('reknaren.token', t);
  sessionStorage.setItem('reknaren.orgId', o);
  sessionStorage.setItem('reknaren.email', 'beg@reknaren.no');
}, [TOKEN, ORG_ID]);
try {
  await page.goto('http://localhost:4315');
  await page.waitForSelector('nav button:has-text("Bilagsinnboks")', { timeout: 10000 });
  await page.click('nav button:has-text("Bilagsinnboks")');
  await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 8000 });
  const pdf = Buffer.from([
    '%PDF-1.7',
    'Komplett Datautstyr AS',
    'Org.nr: 923609016',
    'Faktura: EK-2026-1234',
    'Fakturadato: 2026-02-15',
    'Dell 27 tommer skjerm / monitor',
    'Netto: 7192,00',
    'MVA 25%: 1798,00',
    'Å betale: NOK 8 990,00',
    '%%EOF',
  ].join('\n'), 'utf8');
  await page.setInputFiles('input[type="file"]', { name: 'datautstyr.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.waitForSelector('.toast', { timeout: 12000 });
  await page.waitForSelector('h1:has-text("datautstyr.pdf")', { timeout: 10000 });
  await page.waitForSelector('.panel.impact', { timeout: 8000 });
  await page.click('button:has-text("Hvorfor foreslår dere dette?")');
  await page.waitForSelector('text=Regler og kilder', { timeout: 6000 });
  await page.click('button:has-text("Vis tekniske detaljer")');
  await page.waitForSelector('text=Vurdert av', { timeout: 6000 });
  await page.screenshot({ path: `${SHOTS}/begrunnelseskort.png`, fullPage: true });
  console.log('BEGRUNNELSE-DEMO OK');
  await browser.close();
} catch (err) {
  await page.screenshot({ path: `${SHOTS}/FAILURE.png`, fullPage: true });
  console.error('FAIL:', err.message);
  await browser.close();
  process.exit(1);
}
