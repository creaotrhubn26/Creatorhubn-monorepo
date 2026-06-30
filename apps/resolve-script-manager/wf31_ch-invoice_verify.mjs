import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf31_ch-invoice.html', 'utf8');

const CFG = {
  fakturanr: 'CH-2026-0142',
  kunde: 'Nordlys Bryllup AS',
  l1: 'Fotografering — heldagspakke',
  b1: '14 000',
  l2: 'Redigering og levering (60 bilder)',
  b2: '4 000',
  total: '22500',
  forfall: '30. juni 2026',
  accent: '#ffba6c',
  ink: '#f6f2ea',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf31_ch-invoice_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf31_ch-invoice_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
