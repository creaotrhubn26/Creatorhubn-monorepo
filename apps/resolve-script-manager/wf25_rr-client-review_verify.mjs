import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf25_rr-client-review.html', 'utf8');

const CFG = {
  leveranse: 'Vårkampanje — Hovedfilm 60s',
  klient: 'Nordlys Møbler AS',
  status: 'Til gjennomgang',
  kommentarer: '6',
  c1: 'Åpningen sitter — kan vi holde logoen et halvt sekund lenger før første klipp?',
  c2: 'Fargene på sofaen ser litt kjølige ut mot slutten. Ønsker varmere tone der.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf25_rr-client-review_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf25_rr-client-review_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
